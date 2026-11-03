import json
import re
import asyncio
import httpx
from datetime import datetime, date, time, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logger import logger
from app.ai.tools import TOOLS
from app.ai.tool_executor import ToolExecutor
from app.ai.prompts import SYSTEM_PROMPT
from app.ai.replies import execution_content
from app.ai.scheduling import recurrence_request
from app.ai.confirmation import pending_actions
from app.core.time import local_now, business_today


class PlanifyAgent:
    def __init__(self):
        self.model = settings.AI_MODEL
        self.base_url = "https://api.groq.com/openai/v1"

    @property
    def api_key(self) -> str:
        return settings.get_ai_api_key

    def _is_security_request(self, text: str) -> bool:
        lower = (text or "").lower()
        sec_keywords = [
            "đổi mật khẩu", "thay mật khẩu", "change password", "reset password",
            "xóa tài khoản", "delete account", "mã otp", "quyền admin", "set admin",
            "password hash", "lấy mật khẩu", "hack", "sql injection"
        ]
        return any(k in lower for k in sec_keywords)

    def _is_out_of_scope(self, text: str) -> bool:
        lower = (text or "").lower()
        # Only flag clearly unrelated academic math equations / coding puzzles if no task/event intent
        action_words = ["tạo", "thêm", "lịch", "việc", "task", "event", "họp", "nhắc", "học", "làm", "xóa", "sửa"]
        if any(w in lower for w in action_words):
            return False
        oos_patterns = [
            r"giải phương trình", r"phương trình bậc", r"tính tích phân", r"đạo hàm",
            r"viết bài thơ", r"kể chuyện cười", r"ai là tổng thống"
        ]
        return any(re.search(p, lower) for p in oos_patterns)

    async def chat(
        self,
        user_id: int,
        messages: List[Dict[str, Any]],
        db: AsyncSession,
        user_timezone: str = "Asia/Ho_Chi_Minh",
        conversation_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Execute an agent turn with multi-step tool calling loop and intelligent local NLP fallback.
        """
        last_user_msg = ""
        for m in reversed(messages):
            if m.get("role") == "user":
                last_user_msg = m.get("content", "")
                break

        # 1. Strict Security Guardrail (Requirement 5: manipulate everything EXCEPT security)
        if self._is_security_request(last_user_msg):
            pending_actions.take((user_id, conversation_id))
            return {
                "content": (
                    "🔒 **Giới hạn Bảo mật**: Vì sự an toàn cho tài khoản của bạn, Trợ lý AI được thiết kế "
                    "để không can thiệp vào mật khẩu, mã xác thực OTP hoặc quyền quản trị.\n\n"
                    "👉 Bạn vui lòng truy cập mục **Cài đặt (⚙️) > Bảo mật & Mật khẩu** để thực hiện trực tiếp nhé!"
                ),
                "tool_calls": None,
                "tool_results": None
            }

        # 2. Out-of-scope guardrail check
        if self._is_out_of_scope(last_user_msg):
            pending_actions.take((user_id, conversation_id))
            return {
                "content": (
                    "Xin lỗi bạn! 🙏 Tôi là **Planify AI** — chuyên gia hỗ trợ quản lý lịch trình, công việc cần làm (To Do) "
                    "và tối ưu hóa năng suất cá nhân. Câu hỏi này nằm ngoài phạm vi hỗ trợ của tôi.\n\n"
                    "Bạn có muốn tôi giúp tạo sự kiện, lên danh sách công việc hay sắp xếp kế hoạch hôm nay không?"
                ),
                "tool_calls": None,
                "tool_results": None
            }

        executor = ToolExecutor(user_id=user_id, db=db, conversation_id=conversation_id, request_text=last_user_msg)
        normalized = last_user_msg.strip().lower().rstrip('.!')
        pending = pending_actions.take(executor.context_key)
        if normalized in {"xác nhận xóa", "confirm delete"}:
            if not pending:
                return {"content": "Không có thao tác xóa đang chờ hoặc xác nhận đã hết hạn. Vui lòng yêu cầu lại.", "tool_calls": None, "tool_results": None}
            name, arguments = pending
            executor.confirmed_action = (name, arguments)
            result = await executor.execute(name, arguments)
            return self._execution_reply(executor, "Đã thực hiện thao tác xóa." if result.get("success") else result.get("error"))
        if normalized in {"hủy", "huỷ", "cancel", "không", "khong"}:
            return {"content": "Đã hủy. Không thực hiện thao tác xóa.", "tool_calls": None, "tool_results": None}
        if re.search(r"(?:không|khong|đừng|dung|do not|don't|never)\s+(?:.*?\s)?(?:xóa|xoa|delete|remove|tạo|thêm|create|sửa|update|hoàn thành|complete|dời|reschedule|đánh dấu)", normalized):
            return {"content": "Tôi sẽ không thực hiện thao tác đó.", "tool_calls": None, "tool_results": None}

        # 3. If external LLM API Key is configured, use multi-turn LLM + Tools loop
        if self.api_key:
            try:
                return await self._run_llm_agent_loop(executor, messages, user_timezone, last_user_msg)
            except Exception as e:
                status = e.response.status_code if isinstance(e, httpx.HTTPStatusError) else None
                logger.warning("LLM request failed (%s, HTTP status=%s).", type(e).__name__, status)
                if executor.executions:
                    return self._execution_reply(executor)

        # 4. Built-in Smart Hybrid NLP Agent Engine (works 100% offline/without external API key)
        try:
            result = await self._run_local_smart_agent(executor, last_user_msg)
        except (ValueError, OverflowError) as error:
            return self._execution_reply(executor, str(error))
        if any(not r.get("success") or not name.startswith(("list_", "get_", "search_", "find_", "check_"))
               for name, _, r in executor.executions):
            return self._execution_reply(executor)
        return result

    @staticmethod
    def _execution_reply(executor, content=None):
        summaries = [{"tool": n, "name": n, "arguments": a, "result": r} for n, a, r in executor.executions]
        details = execution_content(executor.executions)
        if details and content and content not in details:
            details += '\n\n' + content
        return {"content": details or content or "Chưa có thao tác nào được thực hiện.", "tool_calls": summaries or None, "tool_results": None}

    def _llm_reply(self, executor, response_msg, tool_results=None):
        content = (response_msg.get("content") or "").strip()
        reply = self._execution_reply(executor)
        writes = any(not name.startswith(("list_", "get_", "search_", "find_", "check_")) for name, _, _ in executor.executions)
        raw_json = content.startswith(("{", "[", "```json")) or bool(re.search(r'"(?:success|free_slots|tool_calls)"\s*:', content))
        # Writes are summarized from committed results, not from provider claims.
        if not executor.executions or (not writes and content and not raw_json):
            reply["content"] = content if content and not raw_json else "Bạn muốn mình hỗ trợ công việc hay lịch trình nào?"
        reply["tool_results"] = tool_results or None
        return reply

    async def _run_llm_agent_loop(
        self,
        executor: ToolExecutor,
        messages: List[Dict[str, Any]],
        user_timezone: str,
        last_user_msg: str
    ) -> Dict[str, Any]:
        system_msg = {
            "role": "system",
            "content": SYSTEM_PROMPT.format(
                current_time=local_now().strftime("%Y-%m-%d %H:%M:%S"),
                user_timezone=user_timezone
            )
        }
        truncated_history = messages[-20:] if len(messages) > 20 else messages
        llm_messages = [system_msg] + truncated_history

        all_tool_results = []

        # Up to 3 reasoning/tool iterations
        for _ in range(3):
            response_msg = await self._call_groq(llm_messages)
            tool_calls = response_msg.get("tool_calls")

            if not tool_calls:
                return self._llm_reply(executor, response_msg, all_tool_results)

            # Response-only fields (e.g. reasoning/annotations) are not request message fields.
            llm_messages.append({"role": "assistant", "content": response_msg.get("content"), "tool_calls": tool_calls})

            for tc in tool_calls:
                tool_name = tc["function"]["name"]
                try:
                    raw_args = tc["function"].get("arguments")
                    tool_args = json.loads(raw_args) if isinstance(raw_args, str) else raw_args
                    if not isinstance(tool_args, dict):
                        raise ValueError('Tool arguments must be an object')
                except (ValueError, TypeError):
                    return self._execution_reply(executor, 'AI trả về thông tin thao tác không hợp lệ. Chưa thực hiện thao tác đó; vui lòng nêu lại yêu cầu rõ hơn.')

                if any(n == tool_name and a == tool_args for n, a, _ in executor.executions) and not tool_name.startswith(("list_", "get_", "search_", "find_", "check_")):
                    return self._execution_reply(executor, "Đã xử lý thao tác này trong lượt chat; không thực hiện lặp.")
                result = await executor.execute(tool_name, tool_args)
                if result.get("requires_confirmation") or not result.get("success"):
                    return self._execution_reply(executor, result.get("error", "Cần làm rõ yêu cầu."))
                tool_msg = {
                    "role": "tool",
                    "tool_call_id": tc["id"],
                    "content": json.dumps(result, ensure_ascii=False)
                }
                all_tool_results.append(tool_msg)
                llm_messages.append(tool_msg)

        final_response = await self._call_groq(llm_messages, allow_tools=False)
        return self._llm_reply(executor, final_response, all_tool_results)

    async def _call_groq(self, messages: List[Dict[str, Any]], allow_tools: bool = True) -> Dict[str, Any]:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        payload: Dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "temperature": 0.2,
            "max_tokens": 1024
        }
        if allow_tools:
            payload["tools"] = TOOLS
            payload["tool_choice"] = "auto"

        for attempt in range(2):
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.post(f"{self.base_url}/chat/completions", headers=headers, json=payload)
                if resp.status_code == 429 and attempt == 0:
                    await asyncio.sleep(1.5)
                    continue
                resp.raise_for_status()
                data = resp.json()
                return data["choices"][0]["message"]
        raise RuntimeError("Rate limit exceeded")

    # =========================================================================
    # BUILT-IN SMART LOCAL NLP AGENT ENGINE (100% Autonomous Tool Calling)
    # =========================================================================
    def _extract_quoted_or_title(self, text: str, fallback_prefix_pattern: str = "") -> str:
        # 1. Check single or double quotes
        m = re.search(r"['\"“”‘’]([^'\"“”‘’]{2,150})['\"“”‘’]", text)
        if m:
            return m.group(1).strip()

        # 2. Remove prefix pattern if provided
        cleaned = text.strip()
        if fallback_prefix_pattern:
            cleaned = re.sub(fallback_prefix_pattern, "", cleaned, flags=re.IGNORECASE).strip()

        # Strip trailing time/date metadata clauses
        cleaned = re.sub(
            r"\s+(bắt đầu từ|vào mỗi|mỗi thứ|hàng tuần|hàng ngày|hàng tháng|hàng năm|từ\s+\d|lúc\s+\d|vào\s+lúc|vào\s+ngày|hạn\s+chót|ngày\s+\d{4}-\d{2}-\d{2}|ngày\s+\d{1,2}/\d{1,2}|hôm nay|ngày mai| và đánh dấu| lặp lại).*$",
            "",
            cleaned,
            flags=re.IGNORECASE
        ).strip(" :,-.")
        return cleaned or "Công việc mới"

    def _extract_date_from_text(self, text: str) -> Optional[date]:
        recurrence, start = recurrence_request(text)
        if recurrence.get('FREQ'):
            return start or business_today()
        lower = text.lower()
        today = business_today()

        # ISO date YYYY-MM-DD
        m_iso = re.search(r"(\d{4}-\d{2}-\d{2})", text)
        if m_iso:
            try:
                return date.fromisoformat(m_iso.group(1))
            except Exception:
                pass

        # DD/MM/YYYY or DD-MM-YYYY
        m_dmy = re.search(r"\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b", text)
        if m_dmy:
            try:
                return date(int(m_dmy.group(3)), int(m_dmy.group(2)), int(m_dmy.group(1)))
            except Exception:
                pass

        # DD/MM
        m_dm = re.search(r"\bngày\s+(\d{1,2})[/-](\d{1,2})\b", lower)
        if m_dm:
            try:
                return date(today.year, int(m_dm.group(2)), int(m_dm.group(1)))
            except Exception:
                pass

        if "ngày kia" in lower or "mốt" in lower:
            return today + timedelta(days=2)
        if "ngày mai" in lower or "tomorrow" in lower or "sáng mai" in lower or "chiều mai" in lower or "tối mai" in lower:
            return today + timedelta(days=1)
        if "hôm nay" in lower or "today" in lower or "tối nay" in lower or "chiều nay" in lower or "sáng nay" in lower:
            return today
        if "tuần sau" in lower or "tuần tới" in lower:
            return today + timedelta(days=7)

        return None

    def _extract_datetimes_or_times(self, text: str, base_date: date):
        # 1. Check full ISO datetimes: YYYY-MM-DDTHH:MM(:SS)
        iso_matches = re.findall(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?", text)
        if len(iso_matches) >= 2:
            s_dt = datetime.fromisoformat(iso_matches[0])
            e_dt = datetime.fromisoformat(iso_matches[1])
            return s_dt, e_dt
        elif len(iso_matches) == 1:
            s_dt = datetime.fromisoformat(iso_matches[0])
            return s_dt, s_dt + timedelta(hours=1)

        # 2. Check time ranges like "từ 09:00 đến 10:30" or "9h đến 11h" or "14h30 - 16h"
        range_match = re.search(
            r"(?:từ|lúc)?\s*(\d{1,2})(?::|h| giờ )(\d{2})?\s*(?:đến|tới|-|->)\s*(\d{1,2})(?::|h| giờ )?(\d{2})?",
            text, re.IGNORECASE
        )
        if range_match:
            h1 = int(range_match.group(1))
            m1 = int(range_match.group(2) or 0)
            h2 = int(range_match.group(3))
            m2 = int(range_match.group(4) or 0)
            if "chiều" in text.lower() or "tối" in text.lower():
                if h1 < 12:
                    h1 += 12
                if h2 < 12:
                    h2 += 12
            s_dt = datetime.combine(base_date, time(h1, m1))
            e_dt = datetime.combine(base_date, time(h2, m2))
            if e_dt <= s_dt:
                raise ValueError('Giờ kết thúc phải sau giờ bắt đầu. Chưa có dữ liệu nào được tạo.')
            return s_dt, e_dt

        # 3. Single time like "lúc 9h30", "14:00", "8 giờ sáng", "3 giờ chiều"
        single_match = re.search(r"(?:lúc|vào)?\s*(\d{1,2})(?::(\d{2})|h(\d{2})?|\s*giờ(?:\s*(\d{1,2}))?)", text, re.IGNORECASE)
        if single_match:
            h = int(single_match.group(1))
            m = int(single_match.group(2) or single_match.group(3) or single_match.group(4) or 0)
            lower = text.lower()
            if ("chiều" in lower or "tối" in lower) and h < 12:
                h += 12
            s_dt = datetime.combine(base_date, time(h, m))
            # Check duration e.g. "45p", "30 phút", "2 tiếng"
            dur_mins = 60
            m_min = re.search(r"(\d+)\s*(?:phút|p\b)", lower)
            m_hr = re.search(r"(\d+)\s*(?:tiếng|giờ đồng hồ)", lower)
            if m_min:
                dur_mins = int(m_min.group(1))
            elif m_hr:
                dur_mins = int(m_hr.group(1)) * 60
            return s_dt, s_dt + timedelta(minutes=dur_mins)

        return None, None

    def _extract_rrule(self, text: str) -> Optional[str]:
        parts, _ = recurrence_request(text)
        if parts.get('FREQ'):
            return ';'.join(f'{key}={value}' for key, value in parts.items())
        lower = text.lower()
        if "hàng ngày" in lower or "mỗi ngày" in lower or "hằng ngày" in lower or "daily" in lower:
            return "FREQ=DAILY"
        if "các ngày trong tuần" in lower or "t2 đến t6" in lower or "thứ 2 đến thứ 6" in lower:
            return "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR"
        if "hàng tuần" in lower or "mỗi tuần" in lower or "weekly" in lower:
            return "FREQ=WEEKLY"
        if "hàng tháng" in lower or "mỗi tháng" in lower or "monthly" in lower:
            return "FREQ=MONTHLY"
        if "hàng năm" in lower or "mỗi năm" in lower or "yearly" in lower:
            return "FREQ=YEARLY"
        return None

    async def _run_local_smart_agent(self, executor: ToolExecutor, user_text: str) -> Dict[str, Any]:
        text = (user_text or "").strip()
        # Quoted task/event names are data, not commands (e.g. create "Hoàn thành báo cáo").
        lower = re.sub(r"['\"“”‘’][^'\"“”‘’]*['\"“”‘’]", "", text.lower())
        create_requested = bool(re.match(r"^(?:(?:hãy|giúp tôi|vui lòng)\s+)*(?:tạo|thêm|create|add|nhắc tôi|lên lịch|đặt lịch)\b", lower))
        change_requested = bool(re.match(r"^(?:(?:hãy|giúp tôi|vui lòng)\s+)*(?:xóa|xoá|hủy|huỷ|dọn|hoàn thành|đánh dấu|dời|chuyển|clear|delete|complete|reschedule)\b", lower))
        executed_tools = []
        tool_results = []

        async def call_tool(name: str, args: dict):
            res = await executor.execute(name, args)
            actual_name, actual_args, _ = executor.executions[-1]
            executed_tools.append({"tool": actual_name, "name": actual_name, "arguments": actual_args, "result": res})
            tool_results.append({
                "role": "tool",
                "tool_call_id": f"local_{len(executed_tools)}",
                "content": json.dumps(res, ensure_ascii=False)
            })
            return res

        # --- CASE 1: Auto-plan My Day / Lập kế hoạch thông minh ---
        if not create_requested and re.match(r'^(?:(?:hãy|giúp tôi|vui lòng)\s+)*(?:tự động lập kế hoạch|sắp xếp ngày của tôi|auto plan|lên kế hoạch hôm nay|tối ưu lịch hôm nay)', lower):
            res = await call_tool("auto_plan_my_day", {"max_tasks": 5, "assign_time_blocks": True})
            data = res.get("data") or {}
            items = data.get("planned_tasks") or []
            if not items:
                content = "✨ Hôm nay bạn chưa có công việc tồn đọng nào cần xếp lịch! Bạn có muốn thêm công việc mới không?"
            else:
                lines = [f"✅ Tôi đã tự động lập kế hoạch **My Day ({data.get('date')})** và gán khung giờ làm việc tối ưu cho **{len(items)} công việc**:"]
                for it in items:
                    t_str = f"⏰ `{it['start_time']} - {it['end_time']}`" if it.get("start_time") else "📌 Cả ngày"
                    star = " ⭐" if it.get("is_important") else ""
                    lines.append(f"- {t_str}: **{it['title']}**{star}")
                content = "\n".join(lines)
            return {"content": content, "tool_calls": executed_tools, "tool_results": tool_results}

        # --- CASE 2: Find free slots / Tìm khung giờ trống ---
        if not create_requested and any(k in lower for k in ["giờ trống", "rảnh lúc nào", "khung giờ trống", "free slot", "thời gian trống"]):
            target_d = self._extract_date_from_text(text) or business_today()
            duration_match = re.search(r"(\d+)\s*(phút|minutes?|tiếng|giờ)\b", lower)
            duration = int(duration_match.group(1)) * (60 if duration_match.group(2) in {"tiếng", "giờ"} else 1) if duration_match else 60
            await call_tool("find_free_slots", {"date": str(target_d), "duration_minutes": duration})
            return {"content": execution_content(executor.executions), "tool_calls": executed_tools, "tool_results": tool_results}

        # --- CASE 3: Productivity Stats / Báo cáo thống kê năng suất ---
        if not create_requested and any(k in lower for k in ["thống kê", "báo cáo năng suất", "tiến độ", "tỷ lệ hoàn thành", "dashboard"]):
            res = await call_tool("get_productivity_stats", {})
            d = res.get("data") or {}
            content = (
                f"📊 **Báo cáo Năng suất Hiện tại của Bạn:**\n"
                f"- Tổng số công việc: **{d.get('total_tasks', 0)}** (Đã hoàn thành: **{d.get('completed_tasks', 0)}** — đạt **{d.get('completion_rate_percent', 0)}%**)\n"
                f"- Công việc trong Ngày của tôi (My Day): **{d.get('my_day_pending_tasks', 0)}** việc đang chờ\n"
                f"- Công việc Quan trọng (⭐): **{d.get('important_pending_tasks', 0)}** việc\n"
                f"- Công việc Quá hạn (⚠️): **{d.get('overdue_tasks', 0)}** việc\n\n"
                f"💡 *Mẹo: Bạn có thể nói \"Dời toàn bộ việc quá hạn sang hôm nay\" hoặc \"Tự động lập kế hoạch hôm nay\" để tôi xử lý ngay!*"
            )
            return {"content": content, "tool_calls": executed_tools, "tool_results": tool_results}

        # --- CASE 4: Batch task actions (Overdue / Complete all My Day / Clear completed) ---
        if change_requested and "quá hạn" in lower and any(k in lower for k in ["dời", "chuyển", "reschedule"]):
            action = "reschedule_overdue_to_tomorrow" if "ngày mai" in lower else "reschedule_overdue_to_today"
            res = await call_tool("batch_update_tasks", {"action": action})
            cnt = (res.get("data") or {}).get("affected_count", 0)
            dest = "ngày mai" if "tomorrow" in action else "hôm nay (My Day)"
            return {
                "content": f"✅ Đã dời hạn **{cnt} công việc quá hạn** sang **{dest}** thành công!",
                "tool_calls": executed_tools,
                "tool_results": tool_results
            }

        if change_requested and any(k in lower for k in ["xóa các việc đã hoàn thành", "dọn dẹp việc đã xong", "clear completed"]):
            res = await call_tool("batch_update_tasks", {"action": "clear_completed"})
            cnt = (res.get("data") or {}).get("affected_count", 0)
            return {
                "content": f"🧹 Đã dọn dẹp và xóa **{cnt} công việc đã hoàn thành** khỏi danh sách.",
                "tool_calls": executed_tools,
                "tool_results": tool_results
            }

        # --- CASE 5: Create Custom Task List or Calendar ---
        if create_requested and any(k in lower for k in ["tạo danh sách", "thêm danh sách", "tạo list"]):
            name = self._extract_quoted_or_title(text, r"^.*?(?:tạo|thêm)\s+(?:danh sách|list)\s*(?:mới|công việc)?\s*(?:tên là)?\s*")
            res = await call_tool("create_task_list", {"name": name, "icon": "🚀", "color": "#4F46E5"})
            d = res.get("data") or {}
            return {
                "content": f"📁 Đã tạo danh sách công việc mới: **{d.get('icon', '🚀')} {d.get('name', name)}**!",
                "tool_calls": executed_tools,
                "tool_results": tool_results
            }

        if create_requested and any(k in lower for k in ["tạo nhóm lịch", "tạo lịch mới", "thêm lịch mới"]):
            name = self._extract_quoted_or_title(text, r"^.*?(?:tạo|thêm)\s+(?:nhóm\s+)?lịch\s*(?:mới)?\s*(?:tên là)?\s*")
            res = await call_tool("create_calendar", {"name": name, "color": "#10B981"})
            d = res.get("data") or {}
            return {
                "content": f"🗓️ Đã tạo lịch mới: **{d.get('name', name)}** thành công!",
                "tool_calls": executed_tools,
                "tool_results": tool_results
            }

        # --- CASE 6: Complete / Delete Task or Event ---
        if change_requested and any(k in lower for k in ["hoàn thành", "đánh dấu xong", "xong việc", "complete task"]):
            title_q = self._extract_quoted_or_title(text, r"^.*?(?:đánh dấu\s+)?(?:hoàn thành|xong)\s+(?:công việc|việc|task)?\s*")
            res = await call_tool("complete_task", {"title_query": title_q, "is_completed": True})
            if res.get("success"):
                d = res["data"]
                content = f"✅ Đã đánh dấu hoàn thành công việc **\"{d['title']}\"**!"
            else:
                content = f"⚠️ {res.get('error', 'Không tìm thấy công việc cần đánh dấu hoàn thành.')}"
            return {"content": content, "tool_calls": executed_tools, "tool_results": tool_results}

        if change_requested and any(k in lower for k in ["xóa sự kiện", "hủy lịch", "hủy cuộc họp", "delete event"]):
            title_q = self._extract_quoted_or_title(text, r"^.*?(?:xóa|hủy)\s+(?:sự kiện|lịch|cuộc họp|event)\s*")
            res = await call_tool("delete_event", {"title_query": title_q})
            if res.get("success"):
                d = res["data"]
                content = f"🗑️ Đã xóa sự kiện **\"{d['title']}\"** khỏi lịch của bạn."
            else:
                content = f"⚠️ {res.get('error', 'Không tìm thấy sự kiện cần xóa.')}"
            return {"content": content, "tool_calls": executed_tools, "tool_results": tool_results}

        if change_requested and any(k in lower for k in ["xóa việc", "xóa công việc", "xóa task", "delete task"]):
            title_q = self._extract_quoted_or_title(text, r"^.*?(?:xóa|bỏ)\s+(?:công việc|việc cần làm|việc|task)\s*")
            res = await call_tool("delete_task", {"title_query": title_q})
            if res.get("success"):
                d = res["data"]
                content = f"🗑️ Đã xóa công việc **\"{d['title']}\"** khỏi danh sách."
            else:
                content = f"⚠️ {res.get('error', 'Không tìm thấy công việc cần xóa.')}"
            return {"content": content, "tool_calls": executed_tools, "tool_results": tool_results}

        # Unsupported local edit/delete requests must never fall through to CREATE.
        if not create_requested and re.match(r"^(?:(?:hãy|giúp tôi|vui lòng)\s+)*(?:xóa|xoá|xoa|delete|remove|sửa|đổi|dời|update|edit|move|reschedule|hoàn thành|complete)\b", lower):
            return {"content": "Tôi chưa xác định rõ thao tác và mục cần thay đổi. Không có dữ liệu nào được sửa. Vui lòng nêu ID, thao tác và thời gian cụ thể hoặc dùng form chỉnh sửa.", "tool_calls": executed_tools or None, "tool_results": tool_results or None}

        # --- CASE 7: Create Task (To Do) ---
        is_task_intent = any(k in lower for k in [
            "việc cần làm", "tạo việc", "thêm việc", "tạo công việc", "thêm công việc",
            "tạo task", "thêm task", "todo", "to-do", "nhắc tôi làm", "nhiệm vụ"
        ]) or bool(re.search(r"\b(?:tạo|thêm)\s+(?:cho tôi\s+)?(?:một\s+)?công việc\b", lower))
        is_event_intent = any(k in lower for k in [
            "sự kiện", "lên lịch", "đặt lịch", "họp", "cuộc họp", "lịch hẹn", "tạo lịch", "event"
        ]) or bool(re.search(r"\b(?:tạo|thêm)\s+(?:cho tôi\s+)?(?:một\s+)?lịch\b", lower))

        if create_requested and is_task_intent and not ("sự kiện" in lower):
            title = self._extract_quoted_or_title(
                text,
                r"^.*?(?:hãy\s+)?(?:tạo|thêm)\s+(?:cho tôi\s+)?(?:một\s+)?(?:công việc|nhiệm vụ|việc cần làm|việc|task)\s*(?:mới)?\s*"
            )
            due_d = self._extract_date_from_text(text)
            s_dt, e_dt = self._extract_datetimes_or_times(text, due_d or business_today())
            rrule = self._extract_rrule(text)
            is_imp = any(k in lower for k in ["quan trọng", "important", "ưu tiên", "đánh dấu sao"])
            is_my_day = bool(due_d == business_today() or any(k in lower for k in ["my day", "ngày của tôi"]))

            task_args: Dict[str, Any] = {
                "title": title,
                "is_important": is_imp,
                "is_in_my_day": is_my_day
            }
            if due_d:
                task_args["due_date"] = str(due_d)
            if s_dt and e_dt:
                task_args["due_date"] = str(s_dt.date())
                task_args["start_time"] = s_dt.strftime("%H:%M")
                task_args["end_time"] = e_dt.strftime("%H:%M")
                task_args["duration_minutes"] = max(1, int((e_dt - s_dt).total_seconds() // 60))
                task_args["is_all_day"] = False
            if rrule:
                task_args["recurrence_rule"] = rrule

            res = await call_tool("create_task", task_args)
            d = res.get("data") or {}
            details = [f"📝 Tiêu đề: **{d.get('title', title)}**"]
            if d.get("due_date"):
                details.append(f"📅 Hạn chót: `{d['due_date']}`")
            if d.get("start_time"):
                details.append(f"⏰ Khung giờ: `{str(d['start_time'])[:5]}`")
            if d.get("is_important"):
                details.append("⭐ Đánh dấu: **Quan trọng**")
            if d.get("is_in_my_day"):
                details.append("☀️ Đã thêm vào: **Ngày của tôi (My Day)**")
            if d.get("recurrence_rule"):
                details.append(f"🔄 Lặp lại: `{d['recurrence_rule']}`")

            return {
                "content": "✅ Đã tạo việc cần làm mới thành công!\n" + "\n".join(f"- {line}" for line in details),
                "tool_calls": executed_tools,
                "tool_results": tool_results
            }

        # --- CASE 8: Create Event (Calendar) ---
        if create_requested and is_event_intent:
            title = self._extract_quoted_or_title(
                text,
                r"^.*?(?:hãy\s+)?(?:tạo|thêm|lên lịch|đặt lịch)\s+(?:cho tôi\s+)?(?:một\s+)?(?:sự kiện|cuộc họp|lịch hẹn|lịch)?\s*"
            )
            target_d = self._extract_date_from_text(text)
            if not target_d:
                return {"content": "Bạn muốn tạo sự kiện vào ngày nào và lúc mấy giờ? Chưa có dữ liệu nào được tạo.", "tool_calls": None, "tool_results": None}
            s_dt, e_dt = self._extract_datetimes_or_times(text, target_d)
            if not s_dt:
                return {"content": "Bạn muốn bắt đầu sự kiện lúc mấy giờ? Chưa có dữ liệu nào được tạo.", "tool_calls": None, "tool_results": None}

            rrule = self._extract_rrule(text)
            ev_args: Dict[str, Any] = {
                "title": title,
                "start_at": s_dt.isoformat(),
                "end_at": e_dt.isoformat()
            }
            if rrule:
                ev_args["recurrence_rule"] = rrule

            res = await call_tool("create_event", ev_args)
            d = res.get("data") or {}
            rrule_info = f"\n- 🔄 Chu kỳ lặp: `{d.get('recurrence_rule')}`" if d.get("recurrence_rule") else ""
            return {
                "content": (
                    f"🗓️ Đã tạo sự kiện trên lịch của bạn thành công!\n"
                    f"- 📌 Sự kiện: **{d.get('title', title)}**\n"
                    f"- 🕒 Thời gian: `{s_dt.strftime('%H:%M %d/%m/%Y')} – {e_dt.strftime('%H:%M %d/%m/%Y')}`"
                    f"{rrule_info}"
                ),
                "tool_calls": executed_tools,
                "tool_results": tool_results
            }

        # --- CASE 9: List tasks (Important, My Day, Overdue, Planned, All) ---
        if any(k in lower for k in ["việc quan trọng", "task quan trọng", "important"]):
            res = await call_tool("list_tasks", {"view": "important", "is_completed": False})
            items = res.get("data") or []
            if not items:
                content = "⭐ Hiện tại bạn không có công việc quan trọng nào đang chờ xử lý."
            else:
                lines = [f"⭐ Bạn có **{len(items)} công việc quan trọng** cần ưu tiên:"]
                for t in items[:10]:
                    due = f" (Hạn: `{t['due_date']}`)" if t.get("due_date") else ""
                    lines.append(f"- **{t['title']}**{due}")
                content = "\n".join(lines)
            return {"content": content, "tool_calls": executed_tools, "tool_results": tool_results}

        if any(k in lower for k in ["danh sách việc", "việc cần làm", "liệt kê công việc", "liệt kê việc", "đã hoàn thành", "đã xong", "my day", "ngày của tôi"]):
            view = "my_day" if ("my day" in lower or "ngày của tôi" in lower) else "all"
            completed = bool(re.search(r'đã (?:hoàn thành|xong)', lower))
            res = await call_tool("list_tasks", {"view": view, "is_completed": completed})
            items = res.get("data") or []
            if not items:
                content = "🎉 Danh sách công việc của bạn hiện đang trống!"
            else:
                lines = [f"📋 Danh sách công việc hiện tại (**{len(items)} việc**):"]
                for t in items[:10]:
                    star = " ⭐" if t.get("is_important") else ""
                    due = f" — 📅 `{t['due_date']}`" if t.get("due_date") else ""
                    lines.append(f"- **{t['title']}**{star}{due}")
                content = "\n".join(lines)
            return {"content": content, "tool_calls": executed_tools, "tool_results": tool_results}

        # --- CASE 10: Advisory / Time management tips ---
        if any(k in lower for k in ["lời khuyên", "mẹo", "quản lý thời gian", "năng suất", "pomodoro", "hiệu quả"]):
            summary_res = await call_tool("get_schedule_summary", {})
            s_data = summary_res.get("data") or {}
            ev_cnt = len(s_data.get("events") or [])
            md_cnt = len(s_data.get("my_day_tasks") or [])
            ov_cnt = len(s_data.get("overdue_tasks") or [])
            return {
                "content": (
                    f"💡 **3 Chiến lược Quản lý Thời gian Tối ưu cho bạn hôm nay** "
                    f"*(Hiện có {ev_cnt} sự kiện, {md_cnt} việc My Day, {ov_cnt} việc quá hạn)*:\n\n"
                    f"1. **Quy tắc 3 Việc Trọng Tâm (MITs)**: Chọn ra tối đa 3 việc có dấu ⭐ Quan trọng nhất trong *My Day* và giải quyết dứt điểm vào khung giờ năng lượng đỉnh cao buổi sáng.\n"
                    f"2. **Đặt Khung Giờ Cố Định (Time-Blocking)**: Kéo các việc cần làm thả trực tiếp vào lưới giờ trên **Calendar** để bảo vệ thời gian tập trung, tránh bị gián đoạn.\n"
                    f"3. **Nghỉ ngắn có kế hoạch**: Sau mỗi khoảng tập trung khoảng 25 phút, dành 5 phút nghỉ trước khi quay lại công việc."
                ),
                "tool_calls": executed_tools,
                "tool_results": tool_results
            }

        # --- DEFAULT: Schedule Summary for Today or Requested Date ---
        target_d = self._extract_date_from_text(text) or business_today()
        await call_tool("get_schedule_summary", {"date": str(target_d)})
        return {
            "content": execution_content(executor.executions),
            "tool_calls": executed_tools,
            "tool_results": tool_results
        }


planify_agent = PlanifyAgent()
