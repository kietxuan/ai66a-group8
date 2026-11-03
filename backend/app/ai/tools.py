TOOLS = [
    # ==================== 1. CALENDAR & EVENTS ====================
    {
        "type": "function",
        "function": {
            "name": "create_event",
            "description": "Tạo sự kiện. Mục trong một ngày không chỉ định nhóm lịch sẽ được lưu thành Task thống nhất và trả item_type=task; dùng task_id và các tool Task để sửa/xóa sau đó. Chỉ sự kiện qua nhiều ngày hoặc chỉ định nhóm lịch dùng Event cũ.",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "Tiêu đề của sự kiện"},
                    "start_at": {"type": "string", "description": "Thời gian bắt đầu theo ISO 8601 (VD: 2026-11-02T09:00:00)"},
                    "end_at": {"type": "string", "description": "Thời gian kết thúc theo ISO 8601 (VD: 2026-11-02T10:00:00)"},
                    "description": {"type": "string", "description": "Mô tả chi tiết hoặc ghi chú cuộc họp"},
                    "location": {"type": "string", "description": "Địa điểm hoặc link họp (Google Meet/Teams/Zoom)"},
                    "is_all_day": {"type": "boolean", "description": "Sự kiện diễn ra cả ngày (mặc định: false)"},
                    "color": {"type": "string", "description": "Mã màu hex (VD: '#4F46E5', '#10B981', '#F59E0B', '#EF4444')"},
                    "recurrence_rule": {"type": "string", "description": "Quy tắc lặp lại RFC 5545 RRULE (VD: FREQ=DAILY, FREQ=WEEKLY;BYDAY=MO,WE,FR, FREQ=MONTHLY)"},
                    "calendar_id": {"type": "integer", "description": "ID lịch muốn lưu"},
                    "calendar_name": {"type": "string", "description": "Tên lịch muốn lưu (nếu không biết calendar_id)"},
                    "reminder_minutes": {"type": "integer", "description": "Số phút nhắc trước sự kiện (VD: 15, 30, 60)"}
                },
                "required": ["title", "start_at"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "update_event",
            "description": "Cập nhật thông tin hoặc dời giờ một sự kiện trên lịch (tìm theo event_id hoặc title_query).",
            "parameters": {
                "type": "object",
                "properties": {
                    "event_id": {"type": "integer", "description": "ID sự kiện cần cập nhật"},
                    "task_id": {"type": "integer", "description": "ID nếu kết quả tạo là item_type=task; không truyền nhầm sang event_id"},
                    "title_query": {"type": "string", "description": "Tên sự kiện cần tìm để cập nhật (nếu không có event_id)"},
                    "title": {"type": "string", "description": "Tiêu đề mới"},
                    "start_at": {"type": "string", "description": "Thời gian bắt đầu mới (ISO 8601)"},
                    "end_at": {"type": "string", "description": "Thời gian kết thúc mới (ISO 8601)"},
                    "description": {"type": "string"},
                    "location": {"type": "string"},
                    "color": {"type": "string"},
                    "is_all_day": {"type": "boolean"},
                    "recurrence_rule": {"type": "string"},
                    "original_start": {"type": "string", "description": "ISO8601 giờ bắt đầu GỐC của lần lặp được chọn; bắt buộc cho this/following, không dùng giờ mới."},
                    "scope": {"type": "string", "enum": ["this", "following", "all"], "description": "Phạm vi áp dụng với sự kiện lặp"}
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "reschedule_event",
            "description": "Dời lịch nhanh một sự kiện sang thời gian mới hoặc lùi/tiến một số phút.",
            "parameters": {
                "type": "object",
                "properties": {
                    "event_id": {"type": "integer"},
                    "task_id": {"type": "integer", "description": "ID mục To Do có lịch (item_type=task)"},
                    "title_query": {"type": "string", "description": "Từ khóa tiêu đề sự kiện"},
                    "new_start_at": {"type": "string", "description": "Thời gian bắt đầu mới (ISO 8601)"},
                    "new_end_at": {"type": "string", "description": "Thời gian kết thúc mới (ISO 8601)"},
                    "shift_minutes": {"type": "integer", "description": "Số phút muốn dời (dương = lùi sau, âm = đẩy sớm)"},
                    "original_start": {"type": "string", "description": "Giờ bắt đầu gốc của lần lặp cần dời (ISO8601)."},
                    "scope": {"type": "string", "enum": ["this", "following", "all"]}
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "delete_event",
            "description": "Xóa một sự kiện trên lịch theo ID hoặc theo tiêu đề.",
            "parameters": {
                "type": "object",
                "properties": {
                    "event_id": {"type": "integer", "description": "ID sự kiện cần xóa"},
                    "task_id": {"type": "integer", "description": "ID mục To Do có lịch (item_type=task)"},
                    "title_query": {"type": "string", "description": "Tiêu đề sự kiện cần xóa (nếu không có event_id)"},
                    "occurrence_date": {"type": "string", "description": "Giờ bắt đầu gốc của lần lặp cần xóa (ISO8601); bắt buộc cho this/following."},
                    "scope": {"type": "string", "enum": ["this", "following", "all"], "description": "Phạm vi xóa với sự kiện lặp"}
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_events",
            "description": "Lấy danh sách các sự kiện trong một khoảng thời gian.",
            "parameters": {
                "type": "object",
                "properties": {
                    "start_date": {"type": "string", "description": "Ngày bắt đầu (YYYY-MM-DD hoặc ISO8601)"},
                    "end_date": {"type": "string", "description": "Ngày kết thúc (YYYY-MM-DD hoặc ISO8601)"},
                    "calendar_id": {"type": "integer", "description": "Lọc theo ID lịch"}
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_events",
            "description": "Tìm kiếm sự kiện theo từ khóa tiêu đề, mô tả hoặc địa điểm.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Từ khóa tìm kiếm"},
                    "days_window": {"type": "integer", "description": "Số ngày tìm kiếm tính từ hôm nay (mặc định 60)"}
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "check_conflicts",
            "description": "Kiểm tra xem một khung thời gian dự kiến có bị trùng (xung đột) với sự kiện hoặc công việc nào không.",
            "parameters": {
                "type": "object",
                "properties": {
                    "start_at": {"type": "string", "description": "Thời gian bắt đầu (ISO 8601)"},
                    "end_at": {"type": "string", "description": "Thời gian kết thúc (ISO 8601)"}
                },
                "required": ["start_at", "end_at"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "find_free_slots",
            "description": "Tìm các khung giờ còn trống trong ngày để xếp lịch họp hoặc làm việc tập trung.",
            "parameters": {
                "type": "object",
                "properties": {
                    "date": {"type": "string", "description": "Ngày cần tìm (YYYY-MM-DD, mặc định hôm nay)"},
                    "duration_minutes": {"type": "integer", "description": "Thời lượng cần trống tính bằng phút (mặc định 60)"},
                    "work_start": {"type": "string", "description": "Giờ bắt đầu ngày làm việc (HH:MM, mặc định 08:00)"},
                    "work_end": {"type": "string", "description": "Giờ kết thúc ngày làm việc (HH:MM, mặc định 21:00)"}
                },
                "required": []
            }
        }
    },

    # ==================== 2. CALENDARS MANAGEMENT ====================
    {
        "type": "function",
        "function": {
            "name": "list_calendars",
            "description": "Lấy danh sách các nhóm lịch (Calendars) hiện có của người dùng.",
            "parameters": {"type": "object", "properties": {}, "required": []}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "create_calendar",
            "description": "Tạo một nhóm lịch mới (VD: Lịch Dự Án, Lịch Cá Nhân, Lịch Tập Luyện).",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Tên lịch mới"},
                    "color": {"type": "string", "description": "Mã màu hex (VD: '#4F46E5')"}
                },
                "required": ["name"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "update_calendar",
            "description": "Đổi tên, đổi màu hoặc ẩn/hiện một nhóm lịch.",
            "parameters": {
                "type": "object",
                "properties": {
                    "calendar_id": {"type": "integer"},
                    "name_query": {"type": "string"},
                    "name": {"type": "string"},
                    "color": {"type": "string"},
                    "is_visible": {"type": "boolean"}
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "delete_calendar",
            "description": "Xóa một nhóm lịch phụ (không xóa được lịch mặc định).",
            "parameters": {
                "type": "object",
                "properties": {
                    "calendar_id": {"type": "integer"},
                    "name_query": {"type": "string"}
                },
                "required": []
            }
        }
    },

    # ==================== 3. TASKS & TO-DO ====================
    {
        "type": "function",
        "function": {
            "name": "create_task",
            "description": "Tạo mục thống nhất như form giao diện, hiển thị ở To Do, Dashboard và Calendar nếu có ngày. Dùng cho cả công việc và lịch học/lịch họp/sự kiện trong ngày. auto_complete=false cho việc tự tích hoàn thành; true cho sự kiện tự hoàn thành khi hết giờ.",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "Tiêu đề công việc"},
                    "note": {"type": "string", "description": "Ghi chú chi tiết"},
                    "location": {"type": "string", "description": "Địa điểm hoặc liên kết họp"},
                    "auto_complete": {"type": "boolean", "description": "True cho sự kiện tự hoàn thành khi hết giờ, false cho công việc cần tích hoàn thành"},
                    "reminder_minutes": {"type": "integer", "description": "Số phút nhắc trước giờ bắt đầu"},
                    "list_id": {"type": "integer", "description": "ID danh sách chứa task"},
                    "list_name": {"type": "string", "description": "Tên danh sách chứa task (nếu không biết list_id)"},
                    "due_date": {"type": "string", "description": "Hạn chót ngày làm (YYYY-MM-DD)"},
                    "due_time": {"type": "string", "description": "Hạn chót giờ làm (HH:MM)"},
                    "start_time": {"type": "string", "description": "Giờ bắt đầu Time-Blocking trên lịch (HH:MM)"},
                    "end_time": {"type": "string", "description": "Giờ kết thúc dự kiến (HH:MM)"},
                    "duration_minutes": {"type": "integer", "description": "Thời lượng công việc tính bằng phút (VD: 30, 60, 90)"},
                    "is_all_day": {"type": "boolean", "description": "False nếu gắn vào khung giờ cụ thể trên lịch"},
                    "color": {"type": "string", "description": "Mã màu hex"},
                    "recurrence_rule": {"type": "string", "description": "Quy tắc lặp lại RFC 5545 RRULE (VD: FREQ=DAILY, FREQ=WEEKLY)"},
                    "is_important": {"type": "boolean", "description": "Đánh dấu sao quan trọng"},
                    "is_in_my_day": {"type": "boolean", "description": "Thêm trực tiếp vào Ngày của tôi (My Day)"},
                    "steps": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Danh sách các bước nhỏ (subtasks)"
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
            "description": "Cập nhật thông tin công việc (tìm theo task_id hoặc từ khóa title_query).",
            "parameters": {
                "type": "object",
                "properties": {
                    "task_id": {"type": "integer", "description": "ID công việc cần sửa"},
                    "title_query": {"type": "string", "description": "Tên công việc cần tìm để sửa (nếu không có task_id)"},
                    "title": {"type": "string"},
                    "note": {"type": "string"},
                    "location": {"type": "string"},
                    "auto_complete": {"type": "boolean"},
                    "reminder_minutes": {"type": "integer"},
                    "due_date": {"type": "string"},
                    "due_time": {"type": "string"},
                    "start_time": {"type": "string"},
                    "end_time": {"type": "string"},
                    "duration_minutes": {"type": "integer"},
                    "is_all_day": {"type": "boolean"},
                    "color": {"type": "string"},
                    "recurrence_rule": {"type": "string"},
                    "is_important": {"type": "boolean"},
                    "is_in_my_day": {"type": "boolean"},
                    "is_completed": {"type": "boolean"},
                    "list_id": {"type": "integer"},
                    "list_name": {"type": "string"}
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "complete_task",
            "description": "Đánh dấu hoàn thành hoặc bỏ hoàn thành một công việc (theo task_id hoặc title_query).",
            "parameters": {
                "type": "object",
                "properties": {
                    "task_id": {"type": "integer", "description": "ID công việc"},
                    "title_query": {"type": "string", "description": "Từ khóa tên công việc"},
                    "is_completed": {"type": "boolean", "description": "True = hoàn thành, False = mở lại (mặc định True)"}
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "delete_task",
            "description": "Xóa một công việc khỏi danh sách (theo task_id hoặc title_query).",
            "parameters": {
                "type": "object",
                "properties": {
                    "task_id": {"type": "integer", "description": "ID công việc cần xóa"},
                    "title_query": {"type": "string", "description": "Từ khóa tên công việc cần xóa"}
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_tasks",
            "description": "Tra cứu danh sách công việc theo chế độ xem thông minh hoặc bộ lọc.",
            "parameters": {
                "type": "object",
                "properties": {
                    "view": {
                        "type": "string",
                        "enum": ["my_day", "important", "planned", "overdue", "completed", "time_blocked", "all"],
                        "description": "Danh sách thông minh cần xem"
                    },
                    "list_id": {"type": "integer", "description": "Lọc theo ID danh sách"},
                    "list_name": {"type": "string", "description": "Lọc theo tên danh sách"},
                    "is_completed": {"type": "boolean", "description": "Lọc theo trạng thái hoàn thành"},
                    "search_query": {"type": "string", "description": "Từ khóa tìm kiếm trong tiêu đề/ghi chú"}
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "batch_update_tasks",
            "description": "Thực hiện thao tác hàng loạt trên nhiều công việc (VD: hoàn thành toàn bộ My Day, dời các việc quá hạn sang hôm nay/ngày mai, xóa các việc đã xong, đưa việc quan trọng vào My Day).",
            "parameters": {
                "type": "object",
                "properties": {
                    "action": {
                        "type": "string",
                        "enum": [
                            "complete_all_my_day",
                            "reschedule_overdue_to_today",
                            "reschedule_overdue_to_tomorrow",
                            "add_important_to_my_day",
                            "clear_completed",
                            "complete_by_ids",
                            "delete_by_ids"
                        ],
                        "description": "Loại thao tác hàng loạt"
                    },
                    "task_ids": {
                        "type": "array",
                        "items": {"type": "integer"},
                        "description": "Danh sách ID công việc (nếu dùng complete_by_ids hoặc delete_by_ids)"
                    }
                },
                "required": ["action"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "schedule_task_on_calendar",
            "description": "Đặt khung giờ làm việc (Time-Blocking) cho một công việc lên lịch biểu, hoặc tự động tìm khung giờ trống trong ngày để xếp việc.",
            "parameters": {
                "type": "object",
                "properties": {
                    "task_id": {"type": "integer"},
                    "title_query": {"type": "string", "description": "Tên công việc cần xếp lịch"},
                    "date": {"type": "string", "description": "Ngày thực hiện (YYYY-MM-DD, mặc định hôm nay)"},
                    "start_time": {"type": "string", "description": "Giờ bắt đầu (HH:MM, nếu bỏ trống sẽ tự tìm giờ trống)"},
                    "duration_minutes": {"type": "integer", "description": "Thời lượng làm việc (phút, mặc định 60)"}
                },
                "required": []
            }
        }
    },

    # ==================== 4. SUBTASKS (STEPS) ====================
    {
        "type": "function",
        "function": {
            "name": "add_task_step",
            "description": "Thêm một hoặc nhiều bước nhỏ (subtask/step) vào một công việc.",
            "parameters": {
                "type": "object",
                "properties": {
                    "task_id": {"type": "integer"},
                    "task_title_query": {"type": "string", "description": "Tên công việc cha"},
                    "step_title": {"type": "string", "description": "Tiêu đề bước con đơn lẻ"},
                    "steps": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Danh sách nhiều bước con muốn thêm cùng lúc"
                    }
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "toggle_task_step",
            "description": "Đánh dấu hoàn thành hoặc chưa hoàn thành một bước nhỏ (step) của công việc.",
            "parameters": {
                "type": "object",
                "properties": {
                    "task_id": {"type": "integer"},
                    "task_title_query": {"type": "string"},
                    "step_id": {"type": "integer"},
                    "step_title_query": {"type": "string"},
                    "is_completed": {"type": "boolean", "description": "True = hoàn thành, False = chưa hoàn thành"}
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "delete_task_step",
            "description": "Xóa một bước nhỏ (subtask/step) khỏi công việc.",
            "parameters": {
                "type": "object",
                "properties": {
                    "task_id": {"type": "integer"},
                    "task_title_query": {"type": "string"},
                    "step_id": {"type": "integer"},
                    "step_title_query": {"type": "string"}
                },
                "required": []
            }
        }
    },

    # ==================== 5. TASK LISTS & CATEGORIES ====================
    {
        "type": "function",
        "function": {
            "name": "list_task_lists",
            "description": "Lấy danh sách tất cả các danh mục công việc (Task Lists) cùng tiến độ hoàn thành.",
            "parameters": {"type": "object", "properties": {}, "required": []}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "create_task_list",
            "description": "Tạo một danh sách công việc mới (VD: Dự án Website, Mua sắm, Học tập).",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Tên danh sách mới"},
                    "icon": {"type": "string", "description": "Biểu tượng emoji (VD: 🚀, 💼, 📚, 🛒)"},
                    "color": {"type": "string", "description": "Mã màu hex (VD: '#4F46E5')"}
                },
                "required": ["name"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "update_task_list",
            "description": "Đổi tên, đổi biểu tượng hoặc màu sắc của một danh sách công việc.",
            "parameters": {
                "type": "object",
                "properties": {
                    "list_id": {"type": "integer"},
                    "name_query": {"type": "string"},
                    "name": {"type": "string"},
                    "icon": {"type": "string"},
                    "color": {"type": "string"}
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "delete_task_list",
            "description": "Xóa một danh sách công việc tùy chỉnh.",
            "parameters": {
                "type": "object",
                "properties": {
                    "list_id": {"type": "integer"},
                    "name_query": {"type": "string"}
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_categories",
            "description": "Lấy danh sách các nhãn màu phân loại (Categories/Tags).",
            "parameters": {"type": "object", "properties": {}, "required": []}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "create_category",
            "description": "Tạo nhãn màu phân loại mới.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Tên nhãn"},
                    "color": {"type": "string", "description": "Mã màu hex (VD: '#10B981')"}
                },
                "required": ["name"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "delete_category",
            "description": "Xóa một nhãn màu phân loại.",
            "parameters": {
                "type": "object",
                "properties": {
                    "category_id": {"type": "integer"},
                    "name_query": {"type": "string"}
                },
                "required": []
            }
        }
    },

    # ==================== 6. DASHBOARD, ANALYTICS & SMART PLANNING ====================
    {
        "type": "function",
        "function": {
            "name": "get_schedule_summary",
            "description": "Lấy tóm tắt tổng quan lịch trình sự kiện, công việc My Day, việc quá hạn và khung giờ trống của một ngày nhất định (mặc định là hôm nay).",
            "parameters": {
                "type": "object",
                "properties": {
                    "date": {"type": "string", "description": "Ngày cần tóm tắt (YYYY-MM-DD), bỏ trống là hôm nay"}
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_productivity_stats",
            "description": "Lấy báo cáo thống kê năng suất toàn diện (tỷ lệ hoàn thành, điểm năng suất, công việc theo danh sách, xu hướng 7 ngày).",
            "parameters": {"type": "object", "properties": {}, "required": []}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "auto_plan_my_day",
            "description": "Tự động lập kế hoạch thông minh cho hôm nay: chọn các việc quá hạn, đến hạn hôm nay và quan trọng đưa vào My Day, đồng thời tự động gán khung giờ làm việc (Time-Blocking) vào các khoảng trống trên lịch.",
            "parameters": {
                "type": "object",
                "properties": {
                    "max_tasks": {"type": "integer", "description": "Số lượng công việc tối đa muốn xếp vào hôm nay (mặc định 5)"},
                    "assign_time_blocks": {"type": "boolean", "description": "Tự động gán giờ làm việc vào các khung giờ trống (mặc định true)"}
                },
                "required": []
            }
        }
    }
]
