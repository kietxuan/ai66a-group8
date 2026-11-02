# 🔄 UX Interaction Flow Enhancements & Vanilla JS Architecture Specification

> **Document Identifier:** `docs/11-ux-interaction-flow-enhancements.md`  
> **Version:** 3.1.0 — Production UX & Interaction Specification  
> **Scope:** Full interaction architecture across Calendar Views, To-Do synchronization, Drag-and-Drop, Collision Packing, Modal Stacking, and Reactive Pub/Sub  
> **Design Constraint:** 100% Vanilla HTML5, CSS3 Variables, and JavaScript ES Modules (Strictly 0 external UI libraries, 0 bundlers)

---

## 1. Executive Architectural Overview & Design Philosophy

Traditional web calendar and task management applications often introduce heavy cognitive friction:
1. **Application Slicing**: Users are forced to switch between separate views or tabs for Calendar (meetings) and To-Do (tasks).
2. **Visual Occlusion**: Concurrent events scheduled at identical times overlap completely, concealing critical schedule items.
3. **Rigid Forms**: Modifying duration or moving events requires opening multi-field form dialogs rather than direct manipulation.
4. **Data Desynchronization**: Actions taken in one module (e.g. AI Agent creating a task or completing an item) fail to reflect in adjacent views without a manual browser reload (`F5`).

Planify solves these challenges using a **Direct Manipulation & Reactive State Architecture** implemented entirely with native browser APIs.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                PLANIFY BROWSER RUNTIME                                 │
│                                                                                        │
│  ┌───────────────────────┐  window.dispatchEvent  ┌─────────────────────────────────┐  │
│  │     User Action       │ ──────────────────────> │  'planify:data-changed' Bus     │  │
│  │ (D&D, Resize, Modal,  │                         └──────────────┬──────────────────┘  │
│  │  AI Agent Execution)  │                                        │                     │
│  └───────────────────────┘                         ┌──────────────┴──────────────┐      │
│             │                                      │                             │      │
│             ▼ (Async API fetch)                    ▼                             ▼      │
│  ┌───────────────────────┐           ┌─────────────────────────┐   ┌─────────────────┐  │
│  │   FastAPI Backend     │           │  Calendar Page Listener │   │  To-Do Listener │  │
│  │   (PostgreSQL 15)     │           │  (Auto-refresh view)    │   │  (Fetch tasks)  │  │
│  └───────────────────────┘           └─────────────────────────┘   └─────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Interaction Flow 1: Agenda / Schedule View (`frontend/js/calendar/agenda-view.js`)

### 2.1. Problem Statement & User Journey
Users on mobile devices or laptops requiring a fast chronological overview of their upcoming commitments previously had to inspect dense Week or Month grids. The Agenda View provides a continuous vertical feed of all events and tasks over a rolling 30-day window.

### 2.2. Visual Layout & Wireframe
```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  Lịch biểu (Agenda View) — 30 ngày tiếp theo                     [<]  [Hôm nay]  [>]    │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  📅 Thứ Hai, 02/11/2026                                            [Hôm nay]            │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │ 09:00 - 10:00  │ 🔵 Họp giao ban đầu tuần                    [Sự kiện]  🏢 Phòng 402│
│  ├────────────────┼─────────────────────────────────────────────────────────────────┤  │
│  │ 10:30 - 11:30  │ ☐ Nộp báo cáo tiến độ Milestone M3         [Việc làm] 📝 Tasks   │  │
│  └────────────────┴─────────────────────────────────────────────────────────────────┘  │
│                                                                                        │
│  📅 Thứ Tư, 04/11/2026                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │ 14:00 - 15:30  │ 🟣 Phỏng vấn ứng viên Frontend Lead          [Sự kiện]  💻 Google Meet│
│  └────────────────┴─────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.3. Technical Implementation Details
1. **Dynamic 30-Day Window Partitioning**:
   - Starting from `this.date`, `startDay` is normalized to `00:00:00` and `endDay` is set to `startDay + 30 days` (`23:59:59.999`).
   - All events and tasks falling within this timestamp interval are collected and indexed into a `Map<YYYY-MM-DD, DayGroup>`.
2. **Whitespace Optimization (Collapsed Empty Days)**:
   - Days with zero events/tasks are suppressed from rendering, *except* for Today (`isToday(d)`), which is always rendered to maintain temporal orientation.
3. **Inline Interactive Task Completion**:
   - Tasks rendered in the Agenda View feature a functional `<input type="checkbox">`.
   - Clicking the checkbox executes `toggleCalendarTaskComplete(item.id, item.is_completed)` from `task-adapter.js`:
     ```javascript
     // agenda-view.js:192-205
     taskCheckbox.addEventListener('click', async (e) => {
       e.stopPropagation();
       const newStatus = taskCheckbox.checked;
       titleSpan.style.textDecoration = newStatus ? 'line-through' : 'none';
       card.style.opacity = newStatus ? '0.6' : '1';
       await toggleCalendarTaskComplete(item.id, item.is_completed);
     });
     ```
   - This fires `PATCH /tasks/{id}/complete`, updates the central store, and emits `planify:data-changed`, instantly synchronizing the To-Do sidebar and any open task detail views without F5.
4. **Direct Detail Navigation**:
   - Clicking an event card opens `EventForm.showFullModal({ event: item, isEdit: true })`.
   - Clicking a task card opens the full Task Detail drawer or navigates directly to the task.

---

## 3. Interaction Flow 2: Event Collision Column Packing (`BUG-15`)

### 3.1. Problem Statement (`BUG-15`)
When multiple events or time-blocked tasks occur during overlapping hours (e.g. 09:00–10:00 and 09:30–10:30), rendering them with standard CSS `left: 0; width: 100%` causes later cards to completely obscure earlier cards.

### 3.2. Greedy Interval Clustering Algorithm
Implemented in `frontend/js/calendar/week-view.js` and `frontend/js/calendar/day-view.js` via `layoutTimedItems(items, hourHeight)`:

```
[Event A: 09:00 - 10:30] ──────────────────────┐
            [Event B: 09:30 - 10:00] ──┐       │ (Cluster: 09:00 - 11:00)
                        [Event C: 10:00 - 11:00] ──┘
                             │
                             ▼ Greedy Column Allocation
┌──────────────────────────────┬──────────────────────────────┐
│ Column 0 (width: calc(50%))  │ Column 1 (width: calc(50%))  │
├──────────────────────────────┼──────────────────────────────┤
│ Event A (09:00 - 10:30)      │ Event B (09:30 - 10:00)      │
│                              ├──────────────────────────────┤
│                              │ Event C (10:00 - 11:00)      │
└──────────────────────────────┴──────────────────────────────┘
```

### 3.3. Algorithmic Steps & Mathematical Geometry
```javascript
// week-view.js:20-94
export function layoutTimedItems(items, hourHeight = 60) {
  // 1. Map items to minute intervals
  const elements = items.map(item => {
    const s = new Date(item.start_at);
    const e = new Date(item.end_at);
    const startMin = s.getHours() * 60 + s.getMinutes();
    const endMin = e.getHours() * 60 + e.getMinutes();
    const durMin = Math.max(15, endMin - startMin);
    return {
      item,
      startMin,
      endMin: startMin + durMin,
      top: (startMin / 60) * hourHeight,
      height: (durMin / 60) * hourHeight,
      col: 0,
      totalCols: 1
    };
  });

  // 2. Sort by start ascending, then duration descending
  elements.sort((a, b) => {
    if (a.startMin !== b.startMin) return a.startMin - b.startMin;
    return b.durMin - a.durMin;
  });

  // 3. Partition into overlapping transitive clusters
  const clusters = [];
  let currentCluster = [];
  let clusterEnd = -1;

  for (const el of elements) {
    if (currentCluster.length === 0) {
      currentCluster.push(el);
      clusterEnd = el.endMin;
    } else {
      if (el.startMin < clusterEnd) {
        currentCluster.push(el);
        clusterEnd = Math.max(clusterEnd, el.endMin);
      } else {
        clusters.push(currentCluster);
        currentCluster = [el];
        clusterEnd = el.endMin;
      }
    }
  }
  if (currentCluster.length > 0) clusters.push(currentCluster);

  // 4. Greedily assign non-conflicting column indices within each cluster
  for (const cluster of clusters) {
    const columns = [];
    for (const el of cluster) {
      let placed = false;
      for (let i = 0; i < columns.length; i++) {
        const lastInCol = columns[i][columns[i].length - 1];
        if (el.startMin >= lastInCol.endMin) {
          columns[i].push(el);
          el.col = i;
          placed = true;
          break;
        }
      }
      if (!placed) {
        el.col = columns.length;
        columns.push([el]);
      }
    }

    // 5. Compute horizontal CSS coordinates with visual gutter
    const totalCols = columns.length;
    for (const el of cluster) {
      el.totalCols = totalCols;
      el.widthPercent = 100 / totalCols;
      el.leftPercent = el.col * el.widthPercent;
    }
  }

  return elements;
}
```

### 3.4. Rendering Execution & Auto-Scroll
- In DOM insertion:
  ```javascript
  card.style.top = `${layout.top}px`;
  card.style.height = `${Math.max(22, layout.height)}px`;
  card.style.left = `calc(${layout.leftPercent}% + 2px)`;
  card.style.width = `calc(${layout.widthPercent}% - 4px)`;
  ```
- **Working Hours Auto-Scroll**: Upon initial render, the scrollable grid container executes:
  ```javascript
  const scrollContainer = weekWrapper.querySelector('.week-grid-scroll');
  if (scrollContainer) {
    scrollContainer.scrollTop = 7 * this.hourHeight; // 420px (07:00 AM)
  }
  ```

---

## 4. Interaction Flow 3: Native HTML5 Drag-and-Drop & Bottom-Edge Duration Resize

### 4.1. Drag-to-Reschedule Flow (Day / Week Views)
Planify avoids external heavyweight drag libraries (such as FullCalendar or InteractJS) by utilizing native browser HTML5 Drag and Drop events.

```
[User mousedown on Card]
       │
       ▼
[dragstart event] ──> Set dataTransfer ('text/plain', JSON { id, type, duration })
       │              Add CSS class '.event-dragging' (opacity: 0.5)
       ▼
[dragover event on Day Column] ──> e.preventDefault() to allow drop
       │                           Visual hover highlight on target column
       ▼
[drop event on Target Column]
       │
       ├── 1. Compute offsetY = e.clientY - columnBoundingRect.top
       ├── 2. Calculate rawMinutes = (offsetY / hourHeight) * 60
       ├── 3. Snap to 15-min grid: Math.round(rawMinutes / 15) * 15
       ├── 4. Construct new target start_at and end_at ISO datetimes
       ├── 5. Execute API: api.put('/events/' + id) OR api.put('/tasks/' + id)
       ├── 6. Set card.dataset.justDragged = 'true' (suppress card.onclick modal)
       └── 7. Dispatch 'planify:data-changed' & show success Toast
```

### 4.2. Bottom-Edge Duration Resize Flow
Cards render an interactive grab bar (`<div class="event-resize-handle"></div>`) pinned to the bottom 6px edge of the card.

```
┌──────────────────────────────────────────────┐
│ 🔵 Họp giao ban dự án                        │
│ 09:00 - 10:00 (60 phút)                      │
│                                              │
├──────────────────────────────────────────────┤ <── .event-resize-handle (cursor: ns-resize)
└──────────────────────────────────────────────┘
```

1. **Mousedown Capture**:
   - `e.stopPropagation()` and `e.preventDefault()`.
   - Records `startY = e.clientY` and `startHeight = parseFloat(card.style.height)`.
2. **Dynamic Pointer Tracking with 15-Minute Snapping**:
   - Attaches `mousemove` and `mouseup` listeners to `window`.
   - Snapping formula:
     ```javascript
     const deltaY = moveEvent.clientY - startY;
     const rawHeight = Math.max(15, startHeight + deltaY);
     // hourHeight = 60px -> 15 minutes = 15px
     const snappedHeight = Math.max(15, Math.round(rawHeight / 15) * 15);
     card.style.height = `${snappedHeight}px`;
     ```
3. **Mouseup Persistence**:
   - Removes window listeners.
   - Computes `newDurationMinutes = Math.round((snappedHeight / hourHeight) * 60)`.
   - Computes `newEndAt = new Date(startAt.getTime() + newDurationMinutes * 60000)`.
   - Invokes backend API and dispatches `planify:data-changed`.
   - Sets `card.dataset.justResized = 'true'`, preventing accidental modal opens.

---

## 5. Interaction Flow 4: Unified Creation Modal (`frontend/js/calendar/event-form.js`)

### 5.1. Problem Statement (`BUG-05`)
In commercial calendar tools, scheduling a calendar event versus creating a time-blocked task requires two completely disparate workflows. In Planify, clicking an empty timeslot allows the user to choose their target entity immediately.

### 5.2. Modal Architecture & Tab Transition
```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  Tạo mới                                                                          [✕]  │
│  ┌───────────────────────────────────┬───────────────────────────────────┐             │
│  │     [📅 Sự kiện] (Active)         │        [✅ Việc cần làm]          │             │
│  └───────────────────────────────────┴───────────────────────────────────┘             │
│                                                                                        │
│  [ Tiêu đề sự kiện...                                                               ]  │
│  Từ: [ 2026-11-02 ] [ 09:00 ]   Đến: [ 2026-11-02 ] [ 10:00 ]  [✓] Cả ngày            │
│  Lịch: [ Lịch làm việc ▾ ]      Màu sắc: [🔵 Indigo ▾ ]                                │
│  Lặp lại: [ Không lặp lại ▾ ]   Nhắc nhở: [ 15 phút trước ▾ ]                          │
│  Vị trí: [ Phòng họp tầng 3                                                         ]  │
│  Mô tả: [ Nội dung chi tiết cuộc họp...                                             ]  │
│                                                                                        │
│  [Hủy bỏ]                                                            [Lưu sự kiện]     │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

When toggling to `[✅ Việc cần làm]`:
- The form transitions smoothly without destroying state.
- Exposes Task List selector, Due Date picker, and **Time-Blocking Section**:
  - Checkbox: `[✓] Đặt khung giờ trên lịch (Time-Blocking)`
  - Start Time and End Time selectors.
  - Quick Duration Pills: `[ 15p ]`, `[ 30p ]`, `[ 45p ]`, `[ 1h ]`, `[ 2h ]`. Clicking a pill automatically updates End Time based on Start Time.
  - Starred `[⭐ Quan trọng]` and `[☀️ Thêm vào Ngày của tôi]` focus toggles.

---

## 6. Interaction Flow 5: Recurrence Scope Selection Modal (`modal.js`, `event-form.js`)

### 6.1. RFC 5545 Recurrence Scope Decision Matrix
When an edit or delete action is initiated on an occurrence of a recurring series, Planify halts the mutation and renders a secondary confirmation dialog with dynamic z-index stacking:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  Chỉnh sửa sự kiện định kỳ                                                        [✕]  │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  Đây là một sự kiện nằm trong chuỗi lặp lại. Bạn muốn áp dụng thay đổi cho:            │
│                                                                                        │
│  (•) Chỉ sự kiện này (this)                                                           │
│      Chỉ cập nhật riêng buổi này vào ngày 02/11/2026; các buổi khác giữ nguyên.        │
│                                                                                        │
│  ( ) Sự kiện này và các sự kiện tiếp theo (following)                                  │
│      Tách chuỗi từ ngày 02/11/2026 trở đi; các buổi trong quá khứ giữ nguyên.         │
│                                                                                        │
│  ( ) Tất cả sự kiện trong chuỗi (all)                                                  │
│      Áp dụng thay đổi cho toàn bộ chuỗi lặp lại.                                       │
│                                                                                        │
│  [Hủy bỏ]                                                                 [Xác nhận]   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 6.2. Stacked Modal Management (`Modal.js`)
To prevent dialog conflicts when an alert or confirmation opens over an existing form modal, `frontend/js/components/modal.js` manages a global LIFO stack:
```javascript
// modal.js:15-32
export class Modal {
  static modalStack = [];

  constructor({ title, content, footer, onClose, width = '520px' }) {
    // Dynamic z-index layering
    const stackDepth = Modal.modalStack.length;
    this.zIndex = 500 + stackDepth * 10;
    this.backdrop.style.zIndex = this.zIndex;
    Modal.modalStack.push(this);
  }

  static handleKeyDown(e) {
    if (e.key === 'Escape' && Modal.modalStack.length > 0) {
      const topModal = Modal.modalStack[Modal.modalStack.length - 1];
      topModal.close();
    }
  }
}
```

### 6.3. Backend Serialization Contract
- **Update with `scope="this"`**: Submits `PUT /events/{id}` with `original_start: toLocalISOString(date)` and `scope: "this"`. Backend creates an exception row (`parent_event_id=id, is_exception=True`).
- **Delete with `scope="this"`**: Submits `DELETE /events/{id}?scope=this&occurrence_date=...`. Backend creates an exception tombstone (`is_cancelled=True, is_exception=True`).
- **Update/Delete with `scope="following"`**: Cuts off parent recurrence (`recurrence_end = cutoff - 1s`) and initializes a new recurring series starting at `start_at`.
- **Update/Delete with `scope="all"`**: Directly mutates the master series and cascades deletion to all child exception rows.

---

## 7. Interaction Flow 6: Bidirectional Real-Time Reactive Sync (`planify:data-changed`)

### 7.1. Global Pub/Sub Event Bus
All state-mutating actions throughout Planify emit the custom browser window event `planify:data-changed`.

```javascript
window.dispatchEvent(new CustomEvent('planify:data-changed', {
  detail: {
    source: 'ai-assistant' | 'calendar' | 'todo' | 'event-form' | 'task-detail',
    action: 'create' | 'update' | 'delete' | 'toggle-task' | 'tool-executed',
    type: 'event' | 'task' | 'all',
    id: 123
  }
}));
```

### 7.2. Subscriber Matrix & Actions

| Subscriber Module | Event Listener | Action Executed on Event | Usability Benefit |
|---|---|---|---|
| `pages/calendar.js` | `window.addEventListener('planify:data-changed')` | Triggers `this.updateView()` to refetch range events & tasks | Events and tasks created by AI or To-Do view appear immediately on the grid without F5. |
| `pages/todo.js` | `window.addEventListener('planify:data-changed')` | Triggers `this.fetchTasks()` and re-renders active smart list | Completing a task on the calendar instantly checks it off in To-Do. |
| `ai/chat-panel.js` | On Groq LLM tool execution completion | Emits `planify:data-changed` with tool execution details | Real-time visual confirmation as the AI schedules items. |
| `components/guide-card.js` | Storage event listener | Updates guide banner collapsed/expanded state across tabs | Consistent user settings. |

---

## 8. Automated Usability & Interaction Verification

The interaction flows documented above are guarded by automated verification suites:

1. **Agenda View & Collision Packing**:
   - `python3 tests/test_m3_verification.py` runs headless Chrome via Chrome DevTools Protocol (CDP), testing 30-day chronological grouping, overlapping card packing geometry (`width: calc(50% - 4px)`), and HTML5 drag/resize.
2. **Recurrence Scope Modal & Timezone Serialization**:
   - `python3 tests/test_m2_verification.py` verifies modal rendering, `toLocalISOString()` time preservation, and database exception persistence.
3. **Reactive Bus & AI Synchronization**:
   - `python3 tests/test_m4_verification.py` triggers task completion and AI tool calls, validating that `planify:data-changed` dispatches and refreshes views with 0 uncaught JavaScript runtime exceptions.

---
*Authored for Planify Milestone M6 Documentation Suite. Certified against Production Commit Hash & Docker Stack.*
