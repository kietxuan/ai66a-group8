# 📅 CHI TIẾT CHỨC NĂNG CALENDAR

Tham khảo: Microsoft Outlook Calendar & Google Calendar

---

## 1. Tổng quan chức năng

Calendar cung cấp khả năng quản lý thời gian trực quan, cho phép xem và quản lý sự kiện theo nhiều dạng view khác nhau.

### Danh sách chức năng

| # | Chức năng | Mức độ | Tham khảo từ |
|---|----------|--------|-------------|
| 1 | Xem lịch theo Ngày/Tuần/Tháng | Core | Google Calendar, Outlook |
| 2 | Tạo sự kiện nhanh (click vào ô) | Core | Google Calendar |
| 3 | Tạo sự kiện chi tiết | Core | Cả hai |
| 4 | Sự kiện cả ngày (All-day) | Core | Cả hai |
| 5 | Sự kiện lặp lại (Recurring) | Core | Cả hai |
| 6 | Kéo thả sự kiện (Drag & Drop) | Nâng cao | Google Calendar |
| 7 | Resize sự kiện (kéo cạnh) | Nâng cao | Google Calendar |
| 8 | Nhiều calendars với màu khác nhau | Core | Cả hai |
| 9 | Nhắc nhở (Reminders) | Core | Cả hai |
| 10 | Sự kiện có màu riêng | Core | Cả hai |
| 11 | Mini calendar (tháng nhỏ) | Core | Outlook |
| 12 | Chuyển nhanh đến ngày hôm nay | Core | Cả hai |
| 13 | Hiển thị tasks trên lịch | Tích hợp | Google Calendar |

---

## 2. Chi tiết từng chức năng

### 2.1. Các dạng View

#### Day View (Xem theo ngày)
```
┌─────────────────────────────────────────────┐
│  ◄  Thứ Hai, 02/11/2026                ►   │
├─────────┬───────────────────────────────────┤
│ All-day │ [Nghỉ lễ Quốc khánh]             │
├─────────┼───────────────────────────────────┤
│  7:00   │                                   │
│  8:00   │ ┌─────────────────────┐           │
│  8:30   │ │ Standup hàng ngày   │           │
│  9:00   │ └─────────────────────┘           │
│  9:00   │ ┌─────────────────────┐           │
│ 10:00   │ │ Họp team - Sprint   │           │
│         │ │ planning            │           │
│ 11:00   │ └─────────────────────┘           │
│ 12:00   │                                   │
│  ...    │                                   │
└─────────┴───────────────────────────────────┘
```

**Thiết kế:**
- Trục dọc: 24 giờ, mỗi ô cao 60px (1 giờ), chia nhỏ 30 phút bằng đường nét đứt
- Khu vực All-day events nằm trên cùng
- Click vào ô trống → tạo sự kiện nhanh tại khung giờ đó
- Sự kiện hiển thị dạng block với chiều cao tỉ lệ thời lượng
- Sự kiện trùng giờ → xếp cạnh nhau, chia đều chiều rộng
- Đường kẻ đỏ ngang chỉ thời điểm hiện tại (current time indicator)

#### Week View (Xem theo tuần)
```
┌─────────────────────────────────────────────────────────────┐
│  ◄  Tuần 44: 02/11 - 08/11/2026                        ►  │
├───────┬───────┬───────┬───────┬───────┬───────┬───────┬────┤
│       │ T.Hai │ T.Ba  │ T.Tư  │ T.Năm │ T.Sáu │ T.Bảy│ CN │
│       │  02   │  03   │  04   │  05   │  06   │  07  │ 08 │
├───────┼───────┼───────┼───────┼───────┼───────┼──────┼────┤
│All-day│       │       │       │       │       │      │    │
├───────┼───────┼───────┼───────┼───────┼───────┼──────┼────┤
│  7:00 │       │       │       │       │       │      │    │
│  8:00 │ ██    │ ██    │ ██    │ ██    │ ██    │      │    │
│  9:00 │ ████  │       │       │       │       │      │    │
│ 10:00 │       │       │       │       │       │      │    │
│  ...  │       │       │       │       │       │      │    │
└───────┴───────┴───────┴───────┴───────┴───────┴──────┴────┘
```

**Thiết kế:**
- 7 cột (Thứ 2 → Chủ nhật), header hiện ngày tháng
- Mỗi cột tương tự Day View nhưng hẹp hơn
- Ngày hiện tại được highlight nền khác
- Sự kiện hiển thị title ngắn gọn

#### Month View (Xem theo tháng)
```
┌─────────────────────────────────────────────────────────────┐
│  ◄  Tháng 11, 2026                                     ►  │
├─────────┬─────────┬─────────┬─────────┬─────────┬────┬─────┤
│  T.Hai  │  T.Ba   │  T.Tư   │  T.Năm  │  T.Sáu  │T.7 │ CN │
├─────────┼─────────┼─────────┼─────────┼─────────┼────┼─────┤
│         │         │         │         │         │    │  1  │
│         │         │         │         │         │    │     │
├─────────┼─────────┼─────────┼─────────┼─────────┼────┼─────┤
│    2    │    3    │    4    │    5    │    6    │  7 │  8  │
│ •Họp    │         │         │ •Sinh   │         │    │     │
│ •Stand..│         │         │  nhật   │         │    │     │
├─────────┼─────────┼─────────┼─────────┼─────────┼────┼─────┤
│   ...   │   ...   │   ...   │   ...   │   ...   │... │ ... │
└─────────┴─────────┴─────────┴─────────┴─────────┴────┴─────┘
```

**Thiết kế:**
- Grid 7 cột × 5-6 hàng
- Mỗi ô hiển thị tối đa 2-3 sự kiện, phần còn lại hiển thị "+N more"
- Click vào ngày → chuyển sang Day View
- Click vào "+N more" → popup hiển thị tất cả sự kiện ngày đó
- Ngày hiện tại: số ngày được highlight bằng vòng tròn màu

---

### 2.2. Tạo sự kiện nhanh (Quick Create)

**Trigger:** Click vào ô thời gian trống trong Day/Week View

```
┌──────────────────────────────────────┐
│ ┌──────────────────────────────────┐ │
│ │ Nhập tiêu đề sự kiện...         │ │
│ └──────────────────────────────────┘ │
│ 📅 02/11/2026  🕐 9:00 - 10:00     │
│                                      │
│ [Thêm chi tiết]    [Lưu]  [Hủy]    │
└──────────────────────────────────────┘
```

**Logic:**
1. Click vào ô giờ → popup nhỏ xuất hiện tại vị trí click
2. Chỉ cần nhập title → Enter hoặc click Lưu → tạo sự kiện 1 tiếng
3. Click "Thêm chi tiết" → mở modal tạo chi tiết đầy đủ

---

### 2.3. Tạo sự kiện chi tiết (Event Detail Modal)

```
┌──────────────────────────────────────────────────┐
│ ╳                    Tạo sự kiện                 │
├──────────────────────────────────────────────────┤
│                                                  │
│ Tiêu đề: [Họp team Sprint Planning          ]   │
│                                                  │
│ 📅 Bắt đầu:  [02/11/2026]  [09:00]             │
│ 📅 Kết thúc:  [02/11/2026]  [10:00]             │
│ ☐ Cả ngày                                       │
│                                                  │
│ 🔄 Lặp lại: [Không lặp lại        ▼]           │
│   ├── Hàng ngày                                  │
│   ├── Hàng tuần vào Thứ Hai                     │
│   ├── Hàng tháng vào ngày 2                     │
│   ├── Hàng năm vào 02/11                        │
│   ├── Các ngày trong tuần (T2-T6)               │
│   └── Tùy chỉnh...                              │
│                                                  │
│ 📍 Địa điểm: [Phòng họp A                  ]    │
│                                                  │
│ 📝 Mô tả:                                       │
│ ┌──────────────────────────────────────────────┐ │
│ │ Sprint planning cho tuần 45...               │ │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ 🔔 Nhắc nhở: [15 phút trước  ▼]  [+ Thêm]     │
│                                                  │
│ 📁 Lịch:     [Lịch của tôi   ▼]                │
│ 🎨 Màu:      [● Mặc định    ▼]                 │
│                                                  │
│            [Hủy]            [Lưu]                │
└──────────────────────────────────────────────────┘
```

---

### 2.4. Tùy chỉnh lặp lại (Custom Recurrence)

```
┌──────────────────────────────────────────┐
│         Tùy chỉnh lặp lại               │
├──────────────────────────────────────────┤
│                                          │
│ Lặp lại mỗi: [2] [Tuần      ▼]         │
│                                          │
│ Vào các ngày: (chỉ hiện khi chọn Tuần)  │
│ [T2] [T3] [T4] [T5] [T6] [T7] [CN]     │
│  ■    □    ■    □    ■    □    □         │
│                                          │
│ Kết thúc:                                │
│ ○ Không bao giờ                          │
│ ● Vào ngày: [31/01/2027]                │
│ ○ Sau: [10] lần                          │
│                                          │
│          [Hủy]         [Xong]            │
└──────────────────────────────────────────┘
```

**Tạo RRULE từ UI:**
- Lặp 2 tuần, T2+T4+T6 → `FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE,FR`
- Hàng tháng ngày 15 → `FREQ=MONTHLY;BYMONTHDAY=15`
- Hàng ngày → `FREQ=DAILY`

---

### 2.5. Sự kiện lặp lại - Chỉnh sửa/Xóa

Khi user click sửa hoặc xóa một sự kiện thuộc series, hiện dialog:

```
┌──────────────────────────────────────────┐
│         Chỉnh sửa sự kiện lặp lại       │
├──────────────────────────────────────────┤
│                                          │
│ ○ Chỉ sự kiện này                       │
│ ○ Sự kiện này và các sự kiện sau         │
│ ○ Tất cả sự kiện trong chuỗi            │
│                                          │
│          [Hủy]           [OK]            │
└──────────────────────────────────────────┘
```

**Logic xử lý backend:**
- **Chỉ sự kiện này**: Tạo event exception với `is_exception=True`, `parent_event_id` trỏ về gốc
- **Từ đây trở đi**: Cập nhật `recurrence_end` cho event gốc, tạo event mới với RRULE mới
- **Tất cả**: Cập nhật trực tiếp event gốc

---

### 2.6. Drag & Drop sự kiện

**Day/Week View:**
- Kéo sự kiện lên/xuống → đổi giờ bắt đầu/kết thúc
- Kéo sự kiện sang cột khác (Week View) → đổi ngày
- Kéo cạnh dưới sự kiện → resize thay đổi thời lượng

**Month View:**
- Kéo sự kiện sang ô ngày khác → đổi ngày

**Implementation (JavaScript thuần):**
```javascript
// Sử dụng mousedown/mousemove/mouseup events
// Không dùng HTML5 Drag API (không phù hợp cho grid-based)

element.addEventListener('mousedown', startDrag);
document.addEventListener('mousemove', onDrag);
document.addEventListener('mouseup', endDrag);

function startDrag(e) {
  // Ghi nhớ vị trí ban đầu, tạo ghost element
}

function onDrag(e) {
  // Tính toán vị trí mới, snap vào grid (15 phút)
  // Highlight ô đích
}

function endDrag(e) {
  // Tính thời gian mới từ vị trí grid
  // Gọi API PUT /events/{id} để cập nhật
}
```

---

### 2.7. Mini Calendar (Sidebar)

```
┌─────────────────────────┐
│   ◄ Tháng 11, 2026 ►   │
├────┬────┬────┬────┬────┬────┬────┤
│ T2 │ T3 │ T4 │ T5 │ T6 │ T7 │ CN │
├────┼────┼────┼────┼────┼────┼────┤
│    │    │    │    │    │    │  1 │
│  2 │  3 │  4 │  5 │  6 │  7 │  8 │
│  9 │ 10 │ 11 │ 12 │ 13 │ 14 │ 15 │
│ 16 │ 17 │ 18 │ 19 │ 20 │ 21 │ 22 │
│ 23 │ 24 │ 25 │ 26 │ 27 │ 28 │ 29 │
│ 30 │    │    │    │    │    │    │
└────┴────┴────┴────┴────┴────┴────┘

📁 Lịch của tôi
  ☑ ● Lịch của tôi (xanh)
  ☑ ● Công việc (xanh lá)
  ☐ ● Cá nhân (cam)
```

**Tính năng:**
- Click ngày → view chính chuyển đến ngày đó
- Ngày có sự kiện → hiện chấm nhỏ dưới số
- Ngày hiện tại → highlight vòng tròn
- Checkbox calendars → ẩn/hiện sự kiện theo calendar

---

### 2.8. Current Time Indicator

```javascript
// Đường kẻ đỏ ngang chỉ thời gian hiện tại trong Day/Week View
function updateTimeIndicator() {
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const top = (minutes / 1440) * totalGridHeight; // 1440 = 24*60
  indicator.style.top = top + 'px';
}

// Cập nhật mỗi phút
setInterval(updateTimeIndicator, 60000);
```

---

### 2.9. Hiển thị Tasks trên Calendar

Tasks có `due_date` sẽ được hiển thị trên lịch dưới dạng sự kiện nhỏ:

```
┌─────────────────────────────────────────┐
│  15/11  Thứ Bảy                         │
├─────────────────────────────────────────┤
│ All-day │ ☑ Hoàn thành báo cáo Q4       │  ← Task
│         │ 🎂 Sinh nhật bạn An            │  ← Event
├─────────┤                                │
│  9:00   │ ┌─ Họp review ──────┐          │  ← Event
│ 10:00   │ └───────────────────┘          │
└─────────┴────────────────────────────────┘
```

- Tasks hiển thị trong khu vực all-day với biểu tượng checkbox
- Có thể click checkbox để đánh dấu hoàn thành ngay trên calendar
- Phân biệt tasks và events bằng icon và style khác nhau

---

## 3. Keyboard Shortcuts

| Phím tắt | Hành động |
|----------|----------|
| `D` | Chuyển Day View |
| `W` | Chuyển Week View |
| `M` | Chuyển Month View |
| `T` | Về ngày hôm nay |
| `←` / `→` | Ngày/tuần/tháng trước/sau |
| `N` | Tạo sự kiện mới |
| `Esc` | Đóng modal/popup |

---

## 4. RRULE Parser (Frontend)

Cần implement một RRULE parser nhẹ cho frontend để tính toán các occurrences:

```javascript
// rrule-parser.js
class RRuleParser {
  /**
   * Parse RRULE string thành object
   * Input: "FREQ=WEEKLY;BYDAY=MO,WE,FR;INTERVAL=2"
   * Output: { freq: 'WEEKLY', byday: ['MO','WE','FR'], interval: 2 }
   */
  static parse(rruleStr) { ... }
  
  /**
   * Tính toán các ngày occurrence trong khoảng thời gian
   * Input: startDate, rrule, rangeStart, rangeEnd
   * Output: [Date, Date, Date, ...]
   */
  static getOccurrences(startDate, rrule, rangeStart, rangeEnd) { ... }
  
  /**
   * Tạo RRULE string từ UI options
   */
  static build(options) { ... }
}
```

---

## 5. Performance Considerations

1. **Lazy loading events**: Chỉ fetch events trong khoảng view hiện tại (+/- 1 tuần buffer)
2. **Virtual scrolling**: Day View có 24*60px = 1440px height, không cần virtual scroll
3. **Debounce drag**: Throttle drag events mỗi 50ms
4. **Cache**: Cache events đã fetch, invalidate khi có thay đổi
5. **RRULE expansion**: Giới hạn tính toán occurrences trong range view + buffer

