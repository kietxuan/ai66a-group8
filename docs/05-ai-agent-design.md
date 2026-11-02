# 🤖 THIẾT KẾ AI AGENT

---

## 1. Tổng quan

AI Agent là trợ lý thông minh tích hợp trong ứng dụng, có khả năng:
- **Gọi tools** để thao tác trực tiếp với Calendar và To Do (tạo/sửa/xóa events, tasks)
- **Đưa lời khuyên** về quản lý thời gian, năng suất
- **Giao tiếp tự nhiên** bằng tiếng Việt
- **Giới hạn phạm vi**: CHỈ hỗ trợ về quản lý thời gian, to-do, lịch, năng suất cá nhân

> **Nguyên tắc thiết kế**: Agent được thiết kế theo kiến trúc tool-calling, tách biệt giữa prompt hệ thống (system prompt) và danh sách tools. Việc mở rộng chức năng chỉ cần thêm tool mới mà không cần chỉnh sửa prompt.

---

## 2. Kiến trúc AI Agent

```
┌─────────────────────────────────────────────────────────┐
│                    AI AGENT SYSTEM                       │
│                                                          │
│  ┌──────────────┐     ┌──────────────────────────────┐  │
│  │  System      │     │      Tool Registry           │  │
│  │  Prompt      │     │  ┌────────────────────────┐  │  │
│  │  (Cố định)   │     │  │ create_event           │  │  │
│  │              │     │  │ update_event           │  │  │
│  │  • Vai trò   │     │  │ delete_event           │  │  │
│  │  • Giới hạn  │     │  │ list_events            │  │  │
│  │  • Phong cách│     │  │ create_task            │  │  │
│  └──────┬───────┘     │  │ update_task            │  │  │
│         │             │  │ delete_task            │  │  │
│         ▼             │  │ complete_task          │  │  │
│  ┌──────────────┐     │  │ list_tasks             │  │  │
│  │   LLM API    │◄───►│  │ get_schedule_summary   │  │  │
│  │  (Groq)      │     │  │ suggest_time_management│  │  │
│  │              │     │  └────────────────────────┘  │  │
│  └──────┬───────┘     └──────────────────────────────┘  │
│         │                                                │
│         ▼                                                │
│  ┌──────────────┐     ┌──────────────────────────────┐  │
│  │  Tool        │────►│      Application APIs        │  │
│  │  Executor    │     │  (Event Service, Task Service)│  │
│  └──────────────┘     └──────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Flow xử lý:

```
User Message
    │
    ▼
┌─────────────┐
│ API Endpoint │  POST /api/v1/ai/conversations/{id}/messages
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Build       │  System Prompt + Message History + Tool Definitions
│ Context     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Call LLM    │  Groq API (gpt-oss-120b) with tools
│ (Groq API)  │
└──────┬──────┘
       │
       ├──── Text Response ──────► Trả về user
       │
       └──── Tool Call(s) ──┐
                             │
                    ┌────────▼────────┐
                    │ Tool Executor   │  Validate args → Execute → Get result
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ Call LLM again  │  Với tool results → Generate final response
                    └────────┬────────┘
                             │
                             ▼
                    Final Response → User
```

---

## 3. System Prompt

```python
SYSTEM_PROMPT = """
Bạn là Planify AI - trợ lý quản lý thời gian thông minh.

## VAI TRÒ
Bạn giúp người dùng quản lý lịch trình, công việc và thời gian hiệu quả.

## PHẠM VI HỖ TRỢ
Bạn CHỈ hỗ trợ các chủ đề sau:
1. Quản lý sự kiện lịch (tạo, sửa, xóa, xem)
2. Quản lý công việc to-do (tạo, sửa, xóa, hoàn thành)
3. Lời khuyên về quản lý thời gian và năng suất
4. Giao tiếp cơ bản (chào hỏi, cảm ơn, hỏi thăm)

## GIỚI HẠN NGHIÊM NGẶT
- KHÔNG trả lời câu hỏi ngoài phạm vi trên (lập trình, toán học, khoa học, chính trị, giải trí, v.v.)
- Khi được hỏi ngoài phạm vi, lịch sự từ chối và gợi ý quay lại chủ đề quản lý thời gian
- KHÔNG bịa đặt thông tin về lịch trình hoặc công việc của người dùng
- Luôn sử dụng tools để truy vấn dữ liệu thực tế trước khi trả lời

## PHONG CÁCH
- Trả lời bằng tiếng Việt, thân thiện, ngắn gọn
- Sử dụng emoji phù hợp
- Khi thực hiện thao tác, xác nhận kết quả rõ ràng
- Đưa ra gợi ý proactive khi phù hợp

## CONTEXT
- Thời gian hiện tại: {current_time}
- Timezone người dùng: {user_timezone}
"""
```

---

## 4. Tool Definitions

### 4.1. Event Tools

```python
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "create_event",
            "description": "Tạo sự kiện mới trên lịch. Sử dụng khi người dùng muốn thêm sự kiện, cuộc họp, hẹn, hoặc bất kỳ hoạt động nào vào lịch.",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {
                        "type": "string",
                        "description": "Tiêu đề sự kiện"
                    },
                    "start_at": {
                        "type": "string",
                        "description": "Thời gian bắt đầu (ISO 8601). Ví dụ: 2026-11-02T09:00:00+07:00"
                    },
                    "end_at": {
                        "type": "string",
                        "description": "Thời gian kết thúc (ISO 8601). Mặc định 1 tiếng sau start_at"
                    },
                    "description": {
                        "type": "string",
                        "description": "Mô tả chi tiết sự kiện (tùy chọn)"
                    },
                    "location": {
                        "type": "string",
                        "description": "Địa điểm (tùy chọn)"
                    },
                    "is_all_day": {
                        "type": "boolean",
                        "description": "Sự kiện cả ngày. Mặc định: false"
                    },
                    "recurrence_rule": {
                        "type": "string",
                        "description": "RRULE cho sự kiện lặp lại. Ví dụ: FREQ=WEEKLY;BYDAY=MO"
                    },
                    "calendar_id": {
                        "type": "integer",
                        "description": "ID calendar. Nếu không chỉ định, dùng calendar mặc định"
                    },
                    "reminder_minutes": {
                        "type": "array",
                        "items": {"type": "integer"},
                        "description": "Danh sách phút nhắc nhở trước sự kiện. Ví dụ: [15, 5]"
                    }
                },
                "required": ["title", "start_at"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "update_event",
            "description": "Cập nhật sự kiện đã có trên lịch. Sử dụng khi người dùng muốn thay đổi thông tin sự kiện.",
            "parameters": {
                "type": "object",
                "properties": {
                    "event_id": {
                        "type": "integer",
                        "description": "ID sự kiện cần cập nhật"
                    },
                    "title": {"type": "string"},
                    "start_at": {"type": "string"},
                    "end_at": {"type": "string"},
                    "description": {"type": "string"},
                    "location": {"type": "string"},
                    "is_all_day": {"type": "boolean"},
                    "recurrence_rule": {"type": "string"},
                    "scope": {
                        "type": "string",
                        "enum": ["this", "following", "all"],
                        "description": "Phạm vi cập nhật cho recurring event. Mặc định: 'this'"
                    }
                },
                "required": ["event_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "delete_event",
            "description": "Xóa sự kiện trên lịch.",
            "parameters": {
                "type": "object",
                "properties": {
                    "event_id": {
                        "type": "integer",
                        "description": "ID sự kiện cần xóa"
                    },
                    "scope": {
                        "type": "string",
                        "enum": ["this", "following", "all"],
                        "description": "Phạm vi xóa cho recurring event. Mặc định: 'this'"
                    }
                },
                "required": ["event_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_events",
            "description": "Lấy danh sách sự kiện trong khoảng thời gian. Sử dụng khi người dùng hỏi về lịch trình, sự kiện sắp tới, hoặc cần xem lịch.",
            "parameters": {
                "type": "object",
                "properties": {
                    "start_date": {
                        "type": "string",
                        "description": "Ngày bắt đầu (YYYY-MM-DD). Mặc định: hôm nay"
                    },
                    "end_date": {
                        "type": "string",
                        "description": "Ngày kết thúc (YYYY-MM-DD). Mặc định: 7 ngày tới"
                    },
                    "calendar_id": {
                        "type": "integer",
                        "description": "Filter theo calendar (tùy chọn)"
                    }
                },
                "required": []
            }
        }
    },
```

### 4.2. Task Tools

```python
    {
        "type": "function",
        "function": {
            "name": "create_task",
            "description": "Tạo task/việc cần làm mới. Sử dụng khi người dùng muốn thêm công việc, nhiệm vụ, việc phải làm.",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {
                        "type": "string",
                        "description": "Tiêu đề task"
                    },
                    "note": {
                        "type": "string",
                        "description": "Ghi chú chi tiết (tùy chọn)"
                    },
                    "list_id": {
                        "type": "integer",
                        "description": "ID list chứa task. Mặc định: list 'Tasks'"
                    },
                    "due_date": {
                        "type": "string",
                        "description": "Ngày hạn (YYYY-MM-DD)"
                    },
                    "due_time": {
                        "type": "string",
                        "description": "Giờ hạn (HH:MM)"
                    },
                    "is_important": {
                        "type": "boolean",
                        "description": "Đánh dấu quan trọng. Mặc định: false"
                    },
                    "is_in_my_day": {
                        "type": "boolean",
                        "description": "Thêm vào My Day. Mặc định: false"
                    },
                    "reminder_at": {
                        "type": "string",
                        "description": "Thời gian nhắc nhở (ISO 8601)"
                    },
                    "recurrence_rule": {
                        "type": "string",
                        "description": "RRULE cho task lặp lại"
                    },
                    "steps": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Danh sách subtasks/bước. Ví dụ: ['Bước 1', 'Bước 2']"
                    }
                },
                "required": ["title"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "update_task",
            "description": "Cập nhật thông tin task.",
            "parameters": {
                "type": "object",
                "properties": {
                    "task_id": {"type": "integer", "description": "ID task"},
                    "title": {"type": "string"},
                    "note": {"type": "string"},
                    "due_date": {"type": "string"},
                    "due_time": {"type": "string"},
                    "is_important": {"type": "boolean"},
                    "is_in_my_day": {"type": "boolean"},
                    "reminder_at": {"type": "string"},
                    "recurrence_rule": {"type": "string"},
                    "list_id": {"type": "integer", "description": "Chuyển sang list khác"}
                },
                "required": ["task_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "complete_task",
            "description": "Đánh dấu task hoàn thành hoặc bỏ hoàn thành.",
            "parameters": {
                "type": "object",
                "properties": {
                    "task_id": {"type": "integer", "description": "ID task"},
                    "is_completed": {"type": "boolean", "description": "true = hoàn thành, false = bỏ hoàn thành"}
                },
                "required": ["task_id", "is_completed"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "delete_task",
            "description": "Xóa task.",
            "parameters": {
                "type": "object",
                "properties": {
                    "task_id": {"type": "integer", "description": "ID task cần xóa"}
                },
                "required": ["task_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_tasks",
            "description": "Lấy danh sách tasks. Sử dụng khi người dùng hỏi về công việc, những gì cần làm.",
            "parameters": {
                "type": "object",
                "properties": {
                    "list_id": {"type": "integer", "description": "Filter theo list"},
                    "view": {
                        "type": "string",
                        "enum": ["my_day", "important", "planned", "all"],
                        "description": "Smart list view"
                    },
                    "is_completed": {
                        "type": "boolean",
                        "description": "Filter theo trạng thái hoàn thành"
                    }
                },
                "required": []
            }
        }
    },
```

### 4.3. Summary & Advisory Tools

```python
    {
        "type": "function",
        "function": {
            "name": "get_schedule_summary",
            "description": "Lấy tóm tắt lịch trình và công việc cho một ngày hoặc khoảng thời gian. Sử dụng khi người dùng hỏi tổng quan, lịch trình hôm nay, hoặc cần overview.",
            "parameters": {
                "type": "object",
                "properties": {
                    "date": {
                        "type": "string",
                        "description": "Ngày cần tóm tắt (YYYY-MM-DD). Mặc định: hôm nay"
                    },
                    "range_days": {
                        "type": "integer",
                        "description": "Số ngày từ date trở đi. Mặc định: 1"
                    }
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_task_lists",
            "description": "Lấy danh sách tất cả task lists của người dùng.",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_calendars",
            "description": "Lấy danh sách tất cả calendars của người dùng.",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }
    }
]
```

---

## 5. Tool Executor

```python
# backend/app/ai/tool_executor.py

class ToolExecutor:
    """
    Thực thi các tools được AI gọi.
    Mỗi tool mapping đến một service method có sẵn.
    """
    
    def __init__(self, user_id: int, db_session):
        self.user_id = user_id
        self.db = db_session
        self.event_service = EventService(db_session)
        self.task_service = TaskService(db_session)
        self.list_service = TaskListService(db_session)
        self.calendar_service = CalendarService(db_session)
    
    async def execute(self, tool_name: str, arguments: dict) -> dict:
        """
        Thực thi tool và trả về kết quả.
        """
        tool_map = {
            "create_event": self._create_event,
            "update_event": self._update_event,
            "delete_event": self._delete_event,
            "list_events": self._list_events,
            "create_task": self._create_task,
            "update_task": self._update_task,
            "complete_task": self._complete_task,
            "delete_task": self._delete_task,
            "list_tasks": self._list_tasks,
            "get_schedule_summary": self._get_schedule_summary,
            "list_task_lists": self._list_task_lists,
            "list_calendars": self._list_calendars,
        }
        
        handler = tool_map.get(tool_name)
        if not handler:
            return {"error": f"Unknown tool: {tool_name}"}
        
        try:
            result = await handler(**arguments)
            return {"success": True, "data": result}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def _create_event(self, title, start_at, **kwargs):
        """Tạo event mới, gọi EventService.create()"""
        ...
    
    async def _create_task(self, title, **kwargs):
        """Tạo task mới, gọi TaskService.create()"""
        ...
    
    # ... (các methods khác tương tự)
```

---

## 6. Agent Orchestrator

```python
# backend/app/ai/agent.py

import httpx
import json
from .tools import TOOLS
from .tool_executor import ToolExecutor
from .prompts import SYSTEM_PROMPT

class PlanifyAgent:
    """
    Orchestrator chính: nhận tin nhắn → gọi LLM → xử lý tool calls → trả kết quả.
    """
    
    def __init__(self, api_key: str, model: str = "openai/gpt-oss-120b"):
        self.api_key = api_key
        self.model = model
        self.base_url = "https://api.groq.com/openai/v1"
    
    async def chat(self, user_id: int, messages: list, db_session) -> dict:
        """
        Xử lý một lượt hội thoại.
        
        Args:
            user_id: ID người dùng
            messages: Lịch sử tin nhắn [{role, content}, ...]
            db_session: Database session
        
        Returns:
            {
                "content": "Nội dung phản hồi",
                "tool_calls": [...],  # Nếu có
                "tool_results": [...]  # Nếu có
            }
        """
        executor = ToolExecutor(user_id, db_session)
        
        # Build messages với system prompt
        full_messages = [
            {"role": "system", "content": self._build_system_prompt(user_id)},
            *messages
        ]
        
        # Gọi LLM lần 1
        response = await self._call_llm(full_messages)
        
        # Nếu không có tool calls, trả về trực tiếp
        if not response.get("tool_calls"):
            return {
                "content": response["content"],
                "tool_calls": None,
                "tool_results": None
            }
        
        # Xử lý tool calls
        tool_calls = response["tool_calls"]
        tool_results = []
        
        for tc in tool_calls:
            result = await executor.execute(
                tc["function"]["name"],
                json.loads(tc["function"]["arguments"])
            )
            tool_results.append({
                "tool_call_id": tc["id"],
                "role": "tool",
                "content": json.dumps(result, ensure_ascii=False)
            })
        
        # Gọi LLM lần 2 với tool results
        full_messages.append(response)  # assistant message với tool_calls
        full_messages.extend(tool_results)
        
        final_response = await self._call_llm(full_messages)
        
        return {
            "content": final_response["content"],
            "tool_calls": tool_calls,
            "tool_results": tool_results
        }
    
    async def _call_llm(self, messages: list) -> dict:
        """Gọi Groq API."""
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": self.model,
                    "messages": messages,
                    "tools": TOOLS,
                    "tool_choice": "auto",
                    "temperature": 0.3,
                    "max_tokens": 2048
                },
                timeout=30.0
            )
            data = resp.json()
            return data["choices"][0]["message"]
    
    def _build_system_prompt(self, user_id: int) -> str:
        """Build system prompt với context hiện tại."""
        from datetime import datetime
        return SYSTEM_PROMPT.format(
            current_time=datetime.now().isoformat(),
            user_timezone="Asia/Ho_Chi_Minh"  # Lấy từ user settings
        )
```

---

## 7. Mở rộng Tools (Extensibility)

### Thêm tool mới chỉ cần 3 bước:

**Bước 1:** Thêm definition vào `tools.py`
```python
{
    "type": "function",
    "function": {
        "name": "new_tool_name",
        "description": "Mô tả tool",
        "parameters": { ... }
    }
}
```

**Bước 2:** Thêm handler vào `tool_executor.py`
```python
async def _new_tool_name(self, **kwargs):
    # Logic xử lý
    pass
```

**Bước 3:** Đăng ký trong `tool_map`
```python
tool_map = {
    ...
    "new_tool_name": self._new_tool_name,
}
```

> ⚠️ **KHÔNG cần chỉnh sửa System Prompt** khi thêm tool mới. LLM tự biết cách sử dụng tool dựa vào description và parameters.

---

## 8. Ví dụ hội thoại

### Ví dụ 1: Tạo sự kiện
```
User: "Tạo cuộc họp team vào thứ 2 tuần tới lúc 9h sáng nhé"

AI: [Gọi tool: create_event]
    → title: "Họp team"
    → start_at: "2026-11-09T09:00:00+07:00"
    → end_at: "2026-11-09T10:00:00+07:00"

AI: "✅ Đã tạo sự kiện **Họp team** vào Thứ Hai, 09/11/2026 lúc 9:00 - 10:00.
     Bạn có muốn đặt nhắc nhở không?"
```

### Ví dụ 2: Hỏi lịch trình
```
User: "Hôm nay tôi có gì?"

AI: [Gọi tool: get_schedule_summary]
    → date: "2026-11-01"

AI: "📅 **Lịch trình hôm nay (01/11):**

    Sự kiện:
    • 9:00 - 10:00: Họp team Sprint Planning
    • 14:00 - 15:30: Review code với Minh

    Công việc cần làm:
    • ⭐ Viết báo cáo Q4 (hạn hôm nay)
    • Gọi điện khách hàng
    • Mua sữa cho con

    ⚠️ Bạn có 1 task quá hạn: Review PR #45 (quá 2 ngày)
    
    💡 Gợi ý: Bạn nên ưu tiên hoàn thành báo cáo Q4 trước 17:00 nhé!"
```

### Ví dụ 3: Từ chối ngoài phạm vi
```
User: "Giải phương trình x^2 + 3x - 4 = 0"

AI: "Xin lỗi, tôi chỉ có thể hỗ trợ bạn về quản lý thời gian và công việc thôi nhé! 😊
     
     Bạn có muốn tôi giúp gì liên quan đến lịch trình hoặc to-do không? Ví dụ:
     • Xem lịch hôm nay
     • Tạo task mới
     • Lên kế hoạch cho tuần tới"
```

### Ví dụ 4: Lời khuyên quản lý thời gian
```
User: "Tôi hay bị quá tải công việc, có lời khuyên gì không?"

AI: "Dưới đây là một số lời khuyên giúp bạn quản lý thời gian hiệu quả hơn:

    1. **Quy tắc 2 phút**: Việc nào làm được trong 2 phút → làm ngay, đừng ghi vào list
    2. **Time Blocking**: Chia ngày thành các khối thời gian cố định cho từng loại việc
    3. **Eat the Frog**: Làm việc khó nhất đầu tiên vào buổi sáng
    4. **My Day**: Mỗi sáng dành 5 phút chọn 3-5 task quan trọng nhất vào My Day
    5. **Review cuối ngày**: Dành 10 phút review và lên kế hoạch cho ngày mai
    
    💡 Bạn có muốn tôi giúp sắp xếp lại công việc của bạn theo phương pháp nào không?"
```

---

## 9. Giao diện Chat

```
┌──────────────────────────────────────────────────┐
│  🤖 Planify AI                            ╳      │
├──────────────────────────────────────────────────┤
│                                                  │
│  Xin chào! 👋 Tôi là Planify AI.                │
│  Tôi có thể giúp bạn quản lý lịch trình         │
│  và công việc. Hãy hỏi tôi bất cứ điều gì!      │
│                                                  │
│  ┌──────────────────────────────────────────┐    │
│  │ 👤 Hôm nay tôi có gì?                   │    │
│  └──────────────────────────────────────────┘    │
│                                                  │
│  ┌──────────────────────────────────────────┐    │
│  │ 🤖 📅 Lịch trình hôm nay (01/11):       │    │
│  │                                          │    │
│  │ Sự kiện:                                 │    │
│  │ • 9:00-10:00: Họp team                   │    │
│  │ • 14:00-15:30: Review code               │    │
│  │                                          │    │
│  │ Công việc:                                │    │
│  │ • ⭐ Viết báo cáo Q4                     │    │
│  │ • Gọi điện khách hàng                    │    │
│  │                                          │    │
│  │ 💡 Gợi ý: Ưu tiên báo cáo Q4!           │    │
│  └──────────────────────────────────────────┘    │
│                                                  │
├──────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────┐ [Gửi] │
│ │ Nhập tin nhắn...                       │       │
│ └────────────────────────────────────────┘       │
└──────────────────────────────────────────────────┘
```

**UI features:**
- Panel chat có thể toggle ẩn/hiện (slide từ phải)
- Tin nhắn AI có hiệu ứng typing indicator khi đang xử lý
- Tool calls hiển thị dạng badge nhỏ (ẩn chi tiết, click mở)
- Lịch sử hội thoại scroll infinite
- Quick action buttons: "Lịch hôm nay", "Tasks cần làm", "Tạo sự kiện"
- Conversation list để chọn/tạo hội thoại mới

---

## 10. Error Handling

```python
# Xử lý lỗi chung cho AI Agent

class AIAgentError(Exception):
    pass

class ToolExecutionError(AIAgentError):
    """Lỗi khi thực thi tool"""
    pass

class LLMAPIError(AIAgentError):
    """Lỗi khi gọi LLM API"""
    pass

class RateLimitError(AIAgentError):
    """Lỗi rate limit"""
    pass

# Retry logic
MAX_RETRIES = 2
RETRY_DELAY = 1  # seconds

# Fallback response khi LLM không khả dụng
FALLBACK_RESPONSE = "Xin lỗi, tôi đang gặp trục trặc kỹ thuật. Bạn vui lòng thử lại sau nhé! 🙏"
```

---

## 11. Security

1. **Rate Limiting**: Tối đa 30 tin nhắn/phút/user (dùng Redis)
2. **Input Sanitization**: Loại bỏ injection attempts trong tin nhắn user
3. **Tool Authorization**: Mỗi tool đều kiểm tra `user_id` ownership
4. **API Key**: Lưu trong biến môi trường, không hardcode
5. **Message History Limit**: Chỉ gửi 20 tin nhắn gần nhất cho LLM để tránh token overflow

