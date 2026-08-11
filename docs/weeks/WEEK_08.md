# WEEK 08 — CONFLICT DETECTION HARDENING & OPTIONAL FEATURES

## Objective
Kiểm thử và hoàn thiện conflict flow đã có từ Week 3. Chỉ làm Dashboard/Statistics nếu còn thời gian.

## Prerequisites
- Create/update task bằng UI và chatbot hoạt động.

## Priority 1 — Conflict Hardening
- [ ] Kiểm thử overlap khi create task.
- [ ] Kiểm thử overlap khi update date/time.
- [ ] Trả task conflict và khoảng thời gian liên quan.
- [ ] Hoàn thiện flow cho user chọn:
  - thay đổi thời gian;
  - hủy;
  - vẫn tiếp tục.
- [ ] Đảm bảo flow hoạt động ở Todo UI và chatbot.

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
- Conflict detection core từ Week 3 được kiểm thử ổn định.
- Todo UI và chatbot xử lý đúng cảnh báo/continue/cancel.
- Optional features không làm ảnh hưởng MVP.
- `PROGRESS.md` cập nhật.
