"""User-facing summaries of actual tool results, independent of the AI provider."""
from datetime import datetime
from app.core.time import BUSINESS_TZ


def _date(value):
    try:
        return datetime.fromisoformat(str(value)).strftime("%d/%m/%Y")
    except (TypeError, ValueError):
        return str(value or "")


def _when(data):
    if data.get("due_date"):
        day = _date(data["due_date"])
        start, end = data.get("start_time"), data.get("end_time")
        return f" ngày {day}" + (f", từ {str(start)[:5]}" + (f" đến {str(end)[:5]}" if end else "") if start else " (cả ngày)")
    start, end = data.get("new_start") or data.get("start_at"), data.get("new_end") or data.get("end_at")
    if start:
        def local(value):
            dt = datetime.fromisoformat(str(value))
            return dt.replace(tzinfo=BUSINESS_TZ) if dt.tzinfo is None else dt.astimezone(BUSINESS_TZ)
        try:
            first = local(start)
            last = local(end) if end else None
            if data.get("is_all_day"):
                return f" ngày {first:%d/%m/%Y} (cả ngày)"
            until = (f" đến {last:%H:%M}" + (f" ngày {last:%d/%m/%Y}" if last.date() != first.date() else "")) if last else ""
            return f" ngày {first:%d/%m/%Y}, từ {first:%H:%M}{until}"
        except (TypeError, ValueError):
            pass
    return ""


def _items(items):
    lines = []
    for item in items[:10]:
        title = item.get("title") or item.get("name") or "Mục chưa có tên"
        status = " (đã hoàn thành)" if item.get("is_completed") else ""
        at = f" — {item['time']}" if item.get("time") else _when(item)
        lines.append(f"- {title}{status}{at}")
    if len(items) > 10:
        lines.append(f"- Và {len(items) - 10} mục khác.")
    return "\n".join(lines)


def _recurrence(rule):
    if not rule:
        return ''
    parts = dict(p.split('=', 1) for p in rule.upper().split(';') if '=' in p)
    units = {'DAILY':'ngày','WEEKLY':'tuần','MONTHLY':'tháng','YEARLY':'năm'}
    unit = units.get(parts.get('FREQ'), '')
    names = {'MO':'thứ Hai','TU':'thứ Ba','WE':'thứ Tư','TH':'thứ Năm','FR':'thứ Sáu','SA':'thứ Bảy','SU':'Chủ nhật'}
    days = ', '.join(names.get(code, code) for code in parts.get('BYDAY','').split(',') if code)
    text = f"Lặp {parts.get('INTERVAL','1')} {unit}/lần" + (f", vào {days}" if days else '')
    if parts.get('UNTIL'):
        until = datetime.fromisoformat(parts['UNTIL'].replace('Z','+00:00'))
        if until.tzinfo:
            until = until.astimezone(BUSINESS_TZ)
        text += f", đến hết ngày {until:%d/%m/%Y}"
    elif parts.get('COUNT'):
        text += f", tổng cộng {parts['COUNT']} lần (gồm lần đầu)"
    else:
        text += ', không giới hạn ngày kết thúc'
    return '\n' + text + '.'


def summarize_tool(name, arguments, result):
    if not result.get("success"):
        return result.get("error") or "Mình chưa thực hiện được thao tác này. Vui lòng kiểm tra lại thông tin."
    data = result.get("data")
    if isinstance(data, list):
        return "Không tìm thấy mục nào phù hợp." if not data else f"Tìm thấy {len(data)} mục:\n{_items(data)}"
    data = data or {}
    title = data.get("title") or data.get("name") or arguments.get("title") or arguments.get("name") or "mục đã chọn"
    if name in {"create_task", "update_task", "schedule_task_on_calendar", "create_event", "update_event", "reschedule_event"}:
        event = name.endswith("event") or data.get("auto_complete")
        kind = "sự kiện" if event else "công việc"
        verb = "tạo" if name.startswith("create_") else "xếp lịch cho" if name == "schedule_task_on_calendar" else "cập nhật"
        text = f"Đã {verb} {kind} **{title}**{_when(data)}."
        if name.startswith("create_"):
            if data.get("item_type") == "task" or name == "create_task":
                text += " Bạn có thể xem mục này trong To Do và Dashboard" + (", đồng thời trên Calendar." if data.get("due_date") else ".")
            else:
                text += " Đây là sự kiện thuộc nhóm lịch/qua nhiều ngày, được hiển thị trên Calendar."
        if data.get("is_completed"):
            text += " Mục này đã hoàn thành; bạn có thể xem ở cột Hoàn thành."
        return text + _recurrence(data.get('recurrence_rule'))
    if name == "complete_task":
        return f"Đã {'hoàn thành' if data.get('is_completed') else 'mở lại'} công việc **{title}**."
    if name.startswith("delete_"):
        return f"Đã xóa **{title}**."
    if name in {"create_calendar", "update_calendar", "create_task_list", "update_task_list", "create_category"}:
        kind = "nhóm lịch" if "calendar" in name else "danh sách công việc" if "list" in name else "nhãn"
        return f"Đã {'tạo' if name.startswith('create_') else 'cập nhật'} {kind} **{title}**."
    if name in {"add_task_step", "toggle_task_step"}:
        return f"Đã {'thêm' if name == 'add_task_step' else 'hoàn thành' if data.get('is_completed') else 'mở lại'} bước **{title}**."
    if name == "batch_update_tasks":
        action = data.get("action") or arguments.get("action", "")
        verb = "xóa" if action in {"clear_completed", "delete_by_ids"} else "dời sang ngày mai" if "tomorrow" in action else "dời sang hôm nay" if "reschedule" in action else "cập nhật"
        return f"Đã {verb} {data.get('affected_count', 0)} công việc."
    if name == "find_free_slots":
        day, duration = _date(data.get("date")), data.get("requested_duration_minutes", arguments.get("duration_minutes", 60))
        slots = data.get("free_slots") or []
        if not slots:
            return f"Ngày {day} không có khung giờ trống đủ {duration} phút trong khoảng giờ bạn chọn."
        lines = [f"Ngày {day}, các khoảng sau còn trống và đủ để xếp một việc dài {duration} phút:"]
        lines += [f"- {s['start']}–{s['end']} ({s['duration_minutes']} phút)" for s in slots]
        return "\n".join(lines)
    if name == "check_conflicts":
        return ("Khung giờ này bị trùng với:\n" + _items(data.get("conflicts") or [])) if data.get("has_conflict") else "Khung giờ này hiện không trùng với sự kiện hoặc công việc nào."
    if name == "get_productivity_stats":
        return (f"Bạn có {data.get('total_tasks', 0)} công việc: {data.get('completed_tasks', 0)} đã hoàn thành, "
                f"{data.get('pending_tasks', 0)} chưa hoàn thành (tỷ lệ hoàn thành {data.get('completion_rate_percent', 0)}%).\n"
                f"- Quá hạn: {data.get('overdue_tasks', 0)}\n- Quan trọng đang chờ: {data.get('important_pending_tasks', 0)}\n"
                f"- Ngày của tôi: {data.get('my_day_pending_tasks', 0)} việc đang chờ.")
    if name == "get_schedule_summary":
        lines = [f"Lịch trình ngày {_date(data.get('date'))}:"]
        scheduled_ids = {item["id"] for item in data.get("scheduled_tasks", [])}
        for key, label in (("events", "Sự kiện"), ("scheduled_tasks", "Công việc có lịch"), ("my_day_tasks", "Ngày của tôi"), ("overdue_tasks", "Công việc quá hạn")):
            items = data.get(key) or []
            if key == "my_day_tasks":
                items = [item for item in items if item["id"] not in scheduled_ids]
            if items:
                lines.append(f"{label}:\n{_items(items)}")
        if len(lines) == 1:
            lines.append("Bạn chưa có sự kiện hoặc công việc nào cho ngày này.")
        if data.get("free_slots"):
            lines.append("Khoảng giờ trống: " + ", ".join(f"{s['start']}–{s['end']}" for s in data["free_slots"]) + ".")
        return "\n".join(lines)
    if name == "auto_plan_my_day":
        items = data.get("planned_tasks") or []
        return f"Đã sắp xếp {len(items)} công việc vào Ngày của tôi." + (f"\n{_items(items)}" if items else " Hiện không có công việc phù hợp để sắp xếp.")
    return "Đã xử lý thao tác theo yêu cầu."


def execution_content(executions):
    return "\n\n".join(summarize_tool(name, args, result) for name, args, result in executions)
