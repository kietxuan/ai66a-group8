# ✅ CHI TIẾT CHỨC NĂNG TO DO

Tham khảo: Microsoft To Do

---

## 1. Tổng quan chức năng

To Do module cung cấp hệ thống quản lý công việc hoàn chỉnh với Smart Lists, danh sách tùy chỉnh, subtasks, và tích hợp chặt chẽ với Calendar.

### Danh sách chức năng

| # | Chức năng | Mức độ | Tham khảo |
|---|----------|--------|-----------|
| 1 | Smart List: My Day | Core | Microsoft To Do |
| 2 | Smart List: Important | Core | Microsoft To Do |
| 3 | Smart List: Planned | Core | Microsoft To Do |
| 4 | Smart List: All | Core | Microsoft To Do |
| 5 | Custom Lists | Core | Microsoft To Do |
| 6 | Tạo/sửa/xóa task | Core | Microsoft To Do |
| 7 | Steps (Subtasks) | Core | Microsoft To Do |
| 8 | Due Date & Time | Core | Microsoft To Do |
| 9 | Reminder | Core | Microsoft To Do |
| 10 | Repeat (Recurring Tasks) | Core | Microsoft To Do |
| 11 | Important (Star) | Core | Microsoft To Do |
| 12 | Notes (Ghi chú) | Core | Microsoft To Do |
| 13 | My Day Suggestions | Core | Microsoft To Do |
| 14 | Drag reorder | Nâng cao | Microsoft To Do |
| 15 | Move task giữa lists | Core | Microsoft To Do |
| 16 | Sort & Filter | Core | Microsoft To Do |
| 17 | Task completion animation | UX | Microsoft To Do |

---

## 2. Layout tổng thể To Do

```
┌──────────────────────────────────────────────────────────────────────┐
│  SIDEBAR (Lists)     │  TASK LIST (Main)         │  TASK DETAIL     │
│                      │                           │                  │
│  ☀ My Day        3   │  ☀ My Day                 │ ╳                │
│  ⭐ Important    5   │  ────────────────────────  │                  │
│  📅 Planned     12   │  + Thêm task              │ ☐ Viết báo cáo   │
│  📋 All         20   │  ────────────────────────  │                  │
│  ─────────────────   │  ☐ ⭐ Viết báo cáo    15/11│ Steps:          │
│  📝 Tasks        8   │  ☐    Mua sữa         Hôm │ ☐ Thu thập data  │
│  🛒 Mua sắm     4   │  ☑    Gọi điện bác   Done │ ☑ Phân tích      │
│  💼 Công việc    6   │  ☐ ⭐ Deploy app      16/11│ ☐ Viết report    │
│  ─────────────────   │                           │                  │
│  + Tạo list mới      │                           │ 📅 Due: 15/11    │
│                      │                           │ 🔔 9:00 15/11    │
│                      │                           │ 🔄 Hàng tuần     │
│                      │                           │ 📋 List: Tasks   │
│                      │                           │                  │
│                      │                           │ 📝 Notes:        │
│                      │                           │ Báo cáo Q4...    │
│                      │                           │                  │
│                      │                           │ Tạo: 01/11       │
└──────────────────────┴───────────────────────────┴──────────────────┘
```

---

## 3. Chi tiết từng chức năng

### 3.1. Smart Lists

#### ☀ My Day
- **Reset hàng ngày**: Danh sách bắt đầu trống mỗi sáng (00:00)
- **Logic**: Hiển thị tasks có `is_in_my_day = true` VÀ `my_day_date = today()`
- **Cơ chế reset**: Backend kiểm tra `my_day_date`, nếu khác ngày hiện tại → coi như chưa thêm vào My Day
- **Suggestions**: Nút 💡 ở góc trên phải → hiện gợi ý tasks nên thêm vào My Day

```
┌──────────────────────────────────────────┐
│  💡 Gợi ý cho My Day                    │
├──────────────────────────────────────────┤
│                                          │
│  Đến hạn hôm nay:                       │
│  ☐ Viết báo cáo Q4                      │  [+ Thêm]
│  ☐ Deploy app v2.0                       │  [+ Thêm]
│                                          │
│  Quá hạn:                                │
│  ☐ Review code PR #45     (quá 2 ngày)   │  [+ Thêm]
│                                          │
│  Gần đây thêm:                           │
│  ☐ Mua sữa cho con                       │  [+ Thêm]
│                                          │
└──────────────────────────────────────────┘
```

**Nguồn gợi ý (ưu tiên):**
1. Tasks đến hạn hôm nay (`due_date = today`)
2. Tasks quá hạn (`due_date < today AND is_completed = false`)
3. Tasks quan trọng chưa hoàn thành (`is_important = true`)
4. Tasks mới tạo gần đây (trong 3 ngày)

#### ⭐ Important
- Filter: `is_important = true AND is_completed = false`
- Sorted by: `due_date ASC NULLS LAST, created_at DESC`

#### 📅 Planned
- Filter: `due_date IS NOT NULL AND is_completed = false`
- Grouped by:
  - **Quá hạn** (due_date < today) - màu đỏ
  - **Hôm nay** (due_date = today) - màu xanh
  - **Ngày mai** (due_date = tomorrow)
  - **Tuần này** (due_date trong tuần hiện tại)
  - **Sau đó** (due_date > cuối tuần này)

```
📅 Planned
─────────────────
  ⚠ Quá hạn (2)
    ☐ Review code PR #45         30/10
    ☐ Gửi invoice tháng 10       31/10
  
  📌 Hôm nay (3)
    ☐ ⭐ Viết báo cáo Q4         01/11
    ☐ Deploy app v2.0             01/11
    ☐ Gọi điện khách hàng         01/11
  
  📆 Ngày mai (1)
    ☐ Họp với đối tác             02/11
  
  📅 Tuần này (2)
    ☐ Chuẩn bị slide thuyết trình 05/11
    ☐ Test integration            07/11
  
  📅 Sau đó (5)
    ☐ ⭐ Release v3.0             15/11
    ...
```

#### 📋 All
- Tất cả tasks chưa hoàn thành, grouped by list

---

### 3.2. Custom Lists

**Tạo list mới:**
```
┌──────────────────────────────────────┐
│ + Tạo list mới                       │
│ ┌──────────────────────────────────┐ │
│ │ 🛒 Tên list...                   │ │
│ └──────────────────────────────────┘ │
│ Màu: ● ● ● ● ● ● ● ● ● ●          │
│ Icon: 📝 🛒 💼 🏠 📚 🎯 💡 🎨      │
│                                      │
│        [Hủy]        [Tạo]           │
└──────────────────────────────────────┘
```

**Quản lý list:**
- Right-click hoặc menu ⋮ trên list:
  - Đổi tên
  - Đổi màu / icon
  - Xóa list (confirm dialog, tasks bên trong sẽ bị xóa)
- Kéo thả để sắp xếp lại thứ tự lists
- List mặc định "Tasks" không thể xóa

---

### 3.3. Task Item

#### Tạo task
```
┌──────────────────────────────────────────────┐
│ + Thêm task                                  │
│ ┌──────────────────────────────────────────┐ │
│ │ Nhập tên task...                         │ │
│ └──────────────────────────────────────────┘ │
│ 📅 Hạn  🔔 Nhắc  🔄 Lặp  ⭐              │
└──────────────────────────────────────────────┘
```

- Nhập title → Enter → tạo task nhanh
- Các icon bên dưới: click để set nhanh due date, reminder, repeat, important
- Task mới được thêm vào đầu hoặc cuối list (tùy setting)

#### Hiển thị task trong list
```
┌──────────────────────────────────────────────────┐
│ ○ ⭐ Viết báo cáo Q4                    📅 15/11 │
│      ├ 1/4 steps                                  │
│      └ 📋 Tasks                                   │
└──────────────────────────────────────────────────┘
```

- `○` Circle checkbox: click để complete (animation vòng tròn tô đầy)
- `⭐` Star: toggle important
- Progress bar nhỏ hiện tiến độ steps
- Tags nhỏ: due date, list name, repeat icon

#### Task Completion Animation
```javascript
// Khi click checkbox:
// 1. Circle checkbox animation: stroke-dashoffset từ full → 0
// 2. Checkmark xuất hiện (stroke animation)
// 3. Sau 300ms: task text strikethrough + opacity giảm
// 4. Sau 500ms: task slide lên/xuống vào section "Completed"
```

---

### 3.4. Task Detail Panel (Sidebar phải)

Khi click vào task, panel chi tiết mở ra bên phải:

```
┌──────────────────────────────────────┐
│                                   ╳  │
│ ○ Viết báo cáo Q4              ⭐   │
│                                      │
│ ─── Steps ───────────────────────    │
│ ☑ Thu thập dữ liệu                  │
│ ☑ Phân tích số liệu                 │
│ ☐ Viết báo cáo                       │
│ ☐ Review với sếp                     │
│ + Thêm bước                          │
│                                      │
│ ─── Chi tiết ────────────────────    │
│ ☀ Thêm vào My Day                   │
│ 📅 Hạn: Thứ Bảy, 15/11/2026        │
│ 🔔 Nhắc: 9:00, 15/11/2026          │
│ 🔄 Lặp: Không lặp                   │
│ 📋 List: Tasks                       │
│                                      │
│ ─── Ghi chú ─────────────────────   │
│ ┌──────────────────────────────────┐ │
│ │ Bao gồm phân tích doanh thu     │ │
│ │ và chi phí quý 4...             │ │
│ └──────────────────────────────────┘ │
│                                      │
│ ─────────────────────────────────    │
│ Tạo ngày: 01/11/2026                │
│                                      │
│ 🗑️ Xóa task                         │
└──────────────────────────────────────┘
```

**Interactions:**
- Click `☀ Thêm vào My Day` → toggle `is_in_my_day`
- Click `📅 Hạn` → date picker popup
- Click `🔔 Nhắc` → datetime picker popup
- Click `🔄 Lặp` → recurrence picker (giống Calendar)
- Click `📋 List` → dropdown chọn list khác (move task)
- Ghi chú: inline editing, auto-save khi blur

---

### 3.5. Due Date Picker

```
┌──────────────────────────────────────┐
│  Chọn ngày hạn                       │
├──────────────────────────────────────┤
│                                      │
│  📌 Hôm nay         Th.7, 01/11     │
│  📆 Ngày mai        CN, 02/11       │
│  📅 Tuần tới        T.2, 09/11      │
│  ─────────────────────────────────   │
│  📅 Chọn ngày...                     │
│  ─────────────────────────────────   │
│  ✕ Xóa ngày hạn                     │
│                                      │
└──────────────────────────────────────┘
```

Click "Chọn ngày..." → mini calendar picker:
```
┌─────────────────────────┐
│   ◄ Tháng 11, 2026 ►   │
├────┬────┬────┬────┬────┬────┬────┤
│ T2 │ T3 │ T4 │ T5 │ T6 │ T7 │ CN │
│    │    │    │    │    │    │  1 │
│  2 │  3 │  4 │  5 │  6 │  7 │  8 │
│  9 │ 10 │ 11 │ 12 │ 13 │ 14 │ 15 │
│ 16 │ 17 │ 18 │ 19 │ 20 │ 21 │ 22 │
│ 23 │ 24 │ 25 │ 26 │ 27 │ 28 │ 29 │
│ 30 │    │    │    │    │    │    │
└────┴────┴────┴────┴────┴────┴────┘
│ ⏰ Thêm giờ: [17:00]              │
│                                    │
│        [Xong]                      │
└────────────────────────────────────┘
```

---

### 3.6. Reminder Picker

```
┌──────────────────────────────────────┐
│  Đặt nhắc nhở                        │
├──────────────────────────────────────┤
│                                      │
│  📌 Sáng nay          09:00         │
│  📆 Sáng mai          09:00         │
│  📅 Tuần tới          T.2, 09:00    │
│  ─────────────────────────────────   │
│  📅 Chọn ngày & giờ...              │
│  ─────────────────────────────────   │
│  ✕ Xóa nhắc nhở                     │
│                                      │
└──────────────────────────────────────┘
```

---

### 3.7. Recurring Task

Khi task có `recurrence_rule`:
- Hoàn thành task → tự động tạo task mới (bản sao) với due_date tiếp theo
- Logic:
  1. User check complete
  2. Backend tính next due date từ RRULE
  3. Tạo task mới identical (cùng title, steps, list, etc.) với due_date mới
  4. Task cũ giữ nguyên trạng thái completed

```javascript
// Ví dụ: Task "Uống thuốc" repeat FREQ=DAILY
// Khi complete task ngày 01/11:
// → Task 01/11: is_completed = true, completed_at = now()
// → Tạo task mới: due_date = 02/11, is_completed = false
```

---

### 3.8. Sort & Filter

Khi xem một list, user có thể sort và filter:

```
┌─────────────────────────────────────────────────────┐
│ 📝 Tasks                          ⇅ Sort  🔽 Filter│
├─────────────────────────────────────────────────────┤

Sort options:
  ○ Quan trọng trước
  ○ Ngày hạn
  ○ Theo bảng chữ cái
  ○ Ngày tạo
  ○ Thủ công (drag reorder)

Filter options:
  ☐ Ẩn task đã hoàn thành
```

---

### 3.9. Completed Tasks Section

```
📝 Tasks
─────────────────────
  ☐ ⭐ Viết báo cáo Q4
  ☐    Mua sữa cho con
  
  ▼ Đã hoàn thành (3)        ← Collapsible
  ────────────────────
  ☑ Gọi điện bác Hùng
  ☑ Nộp thuế
  ☑ Backup dữ liệu
```

- Section "Đã hoàn thành" mặc định collapsed
- Click để expand/collapse
- Tasks completed hiển thị strikethrough, opacity giảm

---

## 4. Tích hợp Calendar ↔ To Do

### 4.1. Tasks hiển thị trên Calendar
- Tasks có `due_date` tự động hiện trên Calendar view tại ngày đó
- Hiển thị trong khu vực all-day events
- Icon checkbox phân biệt với events
- Click checkbox trên Calendar → complete task

### 4.2. Tạo task từ Calendar
- Right-click ngày trên Calendar → "Tạo task" → tự động set due_date

### 4.3. Đồng bộ dữ liệu
- Khi task được tạo/sửa/xóa → Calendar tự động cập nhật
- Cơ chế: Event-driven update qua JavaScript
```javascript
// Khi task thay đổi, emit custom event
document.dispatchEvent(new CustomEvent('task-changed', { 
  detail: { action: 'create', task: taskData } 
}));

// Calendar view lắng nghe
document.addEventListener('task-changed', (e) => {
  calendarView.refreshTasks();
});
```

---

## 5. Keyboard Shortcuts

| Phím tắt | Hành động |
|----------|----------|
| `Enter` | Tạo task mới (khi focus input) |
| `Delete` | Xóa task đang chọn |
| `Space` | Toggle complete task đang chọn |
| `S` | Toggle important |
| `↑` / `↓` | Di chuyển giữa tasks |
| `Esc` | Đóng detail panel |
| `Ctrl+N` | Focus vào input tạo task mới |

