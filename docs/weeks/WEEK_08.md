# WEEK 08 — CONFLICT DETECTION & OPTIONAL ADVANCED FEATURES

## Objective
Hoàn thiện conflict detection. Chỉ làm Dashboard/Statistics nếu còn thời gian.

## Prerequisites
- Create/update task bằng UI và chatbot hoạt động.

## Priority 1 — Conflict Detection
- [ ] Detect overlap khi create task.
- [ ] Detect overlap khi update date/time.
- [ ] Trả task conflict và khoảng thời gian liên quan.
- [ ] Cho user chọn:
  - thay đổi thời gian;
  - hủy;
  - vẫn tiếp tục.
- [ ] Hỗ trợ flow này ở Todo UI và chatbot.

## Priority 2 — Optional Dashboard
Nếu còn thời gian:
- Today's Tasks
- Upcoming
- Completed
- Remaining
- Progress %
- Priority/category summaries

## Priority 3 — Optional Statistics
Chỉ làm sau MVP và conflict detection.

## Tests / Validation
- Không overlap.
- Partial overlap.
- Task nằm trong task khác.
- Cùng start/end boundary theo rule đã chọn.
- Update tạo conflict.
- User vẫn chọn continue.

## Definition of Done
- Conflict detection hoạt động cho create/update.
- Optional features không làm ảnh hưởng MVP.
- `PROGRESS.md` cập nhật.
