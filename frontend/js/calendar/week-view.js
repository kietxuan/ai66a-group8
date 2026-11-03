import { businessNow } from '../utils/date.js';
import { overlapsDay } from '../utils/date.js';
import { recurrenceContext } from './rrule.js';
import { createElement } from '../utils/dom.js';
import { TimeIndicator } from './time-indicator.js';
import { EventForm } from './event-form.js';
import { EventCard } from './event-card.js';
import { getStartOfWeek, addDays, getWeekdayName, isToday, isSameDay, formatDate, toLocalISOString } from '../utils/date.js';
import { api } from '../api.js';
import { Toast } from '../components/toast.js';

/**
 * Helper: Calculate side-by-side columns for overlapping timed events (BUG-15)
 */
export function layoutTimedItems(items, hourHeight = 60, day = null) {
  if (!items || items.length === 0) return [];

  const elements = items.map(item => {
    const s = new Date(item.start_at);
    const end = new Date(item.end_at);
    const dayStart = new Date(day || s); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1);
    const visibleStart = new Date(Math.max(s, dayStart));
    const visibleEnd = new Date(Math.min(end, dayEnd));
    const startMin = visibleStart.getHours() * 60 + visibleStart.getMinutes();
    const durMin = Math.max(15, (visibleEnd - visibleStart) / 60000);
    const endMin = startMin + durMin;
    return {
      item,
      startAt: s,
      endAt: end,
      startMin,
      endMin,
      durMin,
      topPx: (startMin / 60) * hourHeight,
      heightPx: (durMin / 60) * hourHeight - 2,
      col: 0,
      totalCols: 1
    };
  });

  elements.sort((a, b) => {
    if (a.startMin !== b.startMin) return a.startMin - b.startMin;
    return b.durMin - a.durMin;
  });

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
  if (currentCluster.length > 0) {
    clusters.push(currentCluster);
  }

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

    const totalCols = columns.length;
    for (const el of cluster) {
      el.totalCols = totalCols;
      el.widthPercent = 100 / totalCols;
      el.leftPercent = el.col * el.widthPercent;
    }
  }

  return elements;
}

export class WeekView {
  constructor(container, { date = businessNow(), events = [], tasks = [], defaultCalendarId = null, daysCount = 7, onRefresh = null } = {}) {
    this.container = container;
    this.date = new Date(date);
    this.events = events;
    this.tasks = tasks;
    this.defaultCalendarId = defaultCalendarId;
    this.daysCount = daysCount || 7;
    this.onRefresh = onRefresh;
    this.timeIndicator = null;
    this.hourHeight = 60;
  }

  render() {
    this.container.innerHTML = '';

    const startOfWeek = getStartOfWeek(this.date, true);
    const weekDays = [];
    for (let i = 0; i < this.daysCount; i++) {
      weekDays.push(addDays(startOfWeek, i));
    }

    const weekWrapper = createElement('div', {
      className: 'week-view-wrapper',
      style: { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }
    });

    // 1. Column Headers (Weekday names + Day numbers)
    const headerRow = createElement('div', {
      className: 'week-header-row',
      style: {
        display: 'flex',
        borderBottom: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-bg-secondary)',
        paddingLeft: '64px'
      }
    });

    weekDays.forEach((d, idx) => {
      const isTod = isToday(d);
      const colHeader = createElement('div', {
        className: `week-header-col ${isTod ? 'today' : ''}`,
        style: {
          flex: 1,
          padding: '8px 4px',
          textAlign: 'center',
          borderRight: idx < weekDays.length - 1 ? '1px solid var(--color-border-light)' : 'none'
        }
      }, [
        createElement('div', {
          style: { fontSize: '11px', color: 'var(--color-text-secondary)', fontWeight: '600' },
          textContent: getWeekdayName(d.getDay(), true)
        }),
        createElement('div', {
          style: {
            fontSize: '18px',
            fontWeight: isTod ? '700' : '500',
            color: isTod ? 'var(--color-accent)' : 'var(--color-text-primary)',
            width: '32px',
            height: '32px',
            lineHeight: '32px',
            margin: '2px auto 0',
            borderRadius: 'var(--radius-full)',
            backgroundColor: isTod ? 'var(--color-accent-light)' : 'transparent'
          },
          textContent: d.getDate()
        })
      ]);
      headerRow.appendChild(colHeader);
    });

    // 2. All-Day Section across days
    const allDaySection = createElement('div', {
      className: 'week-allday-section',
      style: {
        display: 'flex',
        borderBottom: '1px solid var(--color-border)',
        minHeight: '44px',
        backgroundColor: 'var(--color-bg-secondary)'
      }
    });

    const allDayLabel = createElement('div', {
      className: 'week-allday-label',
      style: {
        width: '64px',
        fontSize: '11px',
        color: 'var(--color-text-secondary)',
        fontWeight: '600',
        padding: '8px 4px',
        textAlign: 'right',
        flexShrink: 0
      },
      textContent: 'Cả ngày'
    });

    const allDayGrid = createElement('div', {
      className: 'week-allday-grid',
      style: { flex: 1, display: 'flex' }
    });

    weekDays.forEach((d, idx) => {
      const col = createElement('div', {
        className: 'week-allday-col',
        style: {
          flex: 1,
          padding: '4px',
          borderRight: idx < weekDays.length - 1 ? '1px solid var(--color-border-light)' : 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px'
        }
      });

      const allDayTasks = this.tasks.filter(t => t.is_all_day && overlapsDay(t, d));
      allDayTasks.forEach(t => {
        col.appendChild(EventCard.create({
          event: t,
          onUpdate: this.onRefresh
        }));
      });

      const allDayEvs = this.events.filter(e => e.is_all_day && overlapsDay(e, d));
      allDayEvs.forEach(e => {
        col.appendChild(EventCard.create({ event: e, onUpdate: this.onRefresh }));
      });

      allDayGrid.appendChild(col);
    });

    allDaySection.appendChild(allDayLabel);
    allDaySection.appendChild(allDayGrid);

    // 3. Scrollable Timed Grid
    const gridScroll = createElement('div', {
      className: 'week-grid-scroll',
      style: { flex: 1, overflowY: 'auto', display: 'flex', position: 'relative' }
    });

    const timeGutter = createElement('div', {
      className: 'week-time-gutter',
      style: { width: '64px', borderRight: '1px solid var(--color-border)', flexShrink: 0 }
    });
    for (let h = 0; h < 24; h++) {
      timeGutter.appendChild(createElement('div', {
        style: {
          height: `${this.hourHeight}px`,
          paddingRight: '8px',
          textAlign: 'right',
          fontSize: '11px',
          color: 'var(--color-text-tertiary)',
          transform: 'translateY(-6px)'
        },
        textContent: `${String(h).padStart(2, '0')}:00`
      }));
    }

    const columnsContainer = createElement('div', {
      className: 'week-columns-container',
      style: { flex: 1, display: 'flex', height: `${24 * this.hourHeight}px`, position: 'relative' }
    });

    weekDays.forEach((d, idx) => {
      const isTod = isToday(d);
      const dayCol = createElement('div', {
        className: `week-day-col ${isTod ? 'today' : ''}`,
        dataset: { date: formatDate(d, 'YYYY-MM-DD') },
        style: {
          flex: 1,
          position: 'relative',
          borderRight: idx < weekDays.length - 1 ? '1px solid var(--color-border-light)' : 'none',
          height: `${24 * this.hourHeight}px`,
          userSelect: 'none'
        }
      });

      for (let h = 0; h < 24; h++) {
        const slot = createElement('div', {
          className: 'week-hour-slot',
          'aria-label': `Tạo lịch ngày ${formatDate(d)} lúc ${h}:00`,
          dataset: { hour: h },
          style: {
            position: 'absolute',
            top: `${h * this.hourHeight}px`,
            left: 0,
            right: 0,
            height: `${this.hourHeight}px`,
            borderBottom: '1px solid var(--color-grid-line-half)',
            cursor: 'pointer'
          },
          onclick: (e) => {
            if (e.target !== slot || dayCol.dataset.justSwept === 'true') return;
            const startAt = new Date(d);
            startAt.setHours(h, 0, 0, 0);
            const endAt = new Date(startAt.getTime() + 3600000);
            EventForm.showQuickCreate({
              startAt,
              endAt,
              defaultCalendarId: this.defaultCalendarId,
              onCreated: this.onRefresh
            });
          }
        });
        dayCol.appendChild(slot);
      }

      // Enable Left-Mouse-Button Drag Range Selection on each day column!
      this.attachLeftMouseDragCreate(dayCol, d);

      if (isTod) {
        this.timeIndicator = new TimeIndicator(dayCol, this.hourHeight);
        this.timeIndicator.mount();
      }

      const dayEvents = this.events.filter(e => !e.is_all_day && overlapsDay(e, d));
      const dayTasks = this.tasks.filter(t => !t.is_all_day && overlapsDay(t, d));
      const allTimedItems = [...dayEvents, ...dayTasks];

      const packedElements = layoutTimedItems(allTimedItems, this.hourHeight, d);

      packedElements.forEach(el => {
        const card = EventCard.create({ event: el.item, onUpdate: this.onRefresh });

        card.style.position = 'absolute';
        card.style.top = `${el.topPx}px`;
        card.style.height = `${el.heightPx}px`;
        card.style.left = `calc(${el.leftPercent}% + 2px)`;
        card.style.width = `calc(${el.widthPercent}% - 4px)`;
        card.style.right = 'auto';

        this.attachCardDraggable(card, el);
        this.attachCardResizeHandle(card, el);

        dayCol.appendChild(card);
      });

      this.attachDayColDrop(dayCol, d);

      columnsContainer.appendChild(dayCol);
    });

    gridScroll.appendChild(timeGutter);
    gridScroll.appendChild(columnsContainer);

    weekWrapper.appendChild(headerRow);
    weekWrapper.appendChild(allDaySection);
    weekWrapper.appendChild(gridScroll);
    this.container.appendChild(weekWrapper);

    const targetHour = 7;
    gridScroll.scrollTop = targetHour * this.hourHeight;
  }

  /**
   * Left-mouse-button click-and-drag range selection on a day column
   */
  attachLeftMouseDragCreate(dayCol, targetDate) {
    dayCol.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      if (e.target.closest('.event-card') || e.target.closest('.event-resize-handle')) return;

      const rect = dayCol.getBoundingClientRect();
      const startY = Math.max(0, Math.min(24 * this.hourHeight, e.clientY - rect.top));
      const snapPx = this.hourHeight / 4; // 15m increments
      const anchorPx = Math.floor(startY / snapPx) * snapPx;

      let ghostEl = null;
      let hasDragged = false;
      let curTopPx = anchorPx;
      let curBottomPx = anchorPx + snapPx * 2;

      const formatMins = (mins) => {
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      };

      const onMouseMove = (moveEv) => {
        const curY = Math.max(0, Math.min(24 * this.hourHeight, moveEv.clientY - rect.top));
        if (Math.abs(curY - startY) < 12 && !hasDragged) return;
        hasDragged = true;

        const snappedCur = Math.round(curY / snapPx) * snapPx;
        curTopPx = Math.min(anchorPx, snappedCur);
        curBottomPx = Math.max(anchorPx + snapPx, snappedCur);

        if (!ghostEl) {
          ghostEl = createElement('div', { className: 'grid-drag-selection' });
          dayCol.appendChild(ghostEl);
        }

        const sMins = Math.round((curTopPx / this.hourHeight) * 60);
        const eMins = Math.min(24 * 60, Math.round((curBottomPx / this.hourHeight) * 60));
        ghostEl.style.top = `${curTopPx}px`;
        ghostEl.style.height = `${Math.max(snapPx, curBottomPx - curTopPx)}px`;
        ghostEl.textContent = `➕ ${formatMins(sMins)} - ${formatMins(eMins)}`;
      };

      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);

        if (ghostEl) {
          ghostEl.remove();
          ghostEl = null;
        }

        if (hasDragged) {
          dayCol.dataset.justSwept = 'true';
          setTimeout(() => { dayCol.dataset.justSwept = 'false'; }, 200);

          const sMins = Math.round((curTopPx / this.hourHeight) * 60);
          const eMins = Math.min(23 * 60 + 59, Math.max(sMins + 15, Math.round((curBottomPx / this.hourHeight) * 60)));

          const startAt = new Date(targetDate);
          startAt.setHours(Math.floor(sMins / 60), sMins % 60, 0, 0);
          const endAt = new Date(targetDate);
          endAt.setHours(Math.floor(eMins / 60), eMins % 60, 0, 0);

          EventForm.showQuickCreate({
            startAt,
            endAt,
            defaultCalendarId: this.defaultCalendarId,
            onCreated: this.onRefresh
          });
        }
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });
  }

  attachCardDraggable(card, el) {
    card.setAttribute('draggable', 'true');

    card.addEventListener('dragstart', (e) => {
      e.stopPropagation();
      const dragPayload = {
        id: el.item.id,
        is_task: !!el.item.is_task,
              ...recurrenceContext(el.item),
        durationMinutes: el.durMin,
        title: el.item.title,
        start_at: el.item.start_at,
        end_at: el.item.end_at,
        color: el.item.color
      };
      e.dataTransfer.setData('text/plain', JSON.stringify(dragPayload));
      e.dataTransfer.effectAllowed = 'move';
      card.classList.add('event-dragging');
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('event-dragging');
      card.dataset.justDragged = 'true';
      setTimeout(() => { card.dataset.justDragged = 'false'; }, 200);
      document.querySelectorAll('.day-col-dragover').forEach(c => c.classList.remove('day-col-dragover'));
    });
  }

  attachCardResizeHandle(card, el) {
    const resizeHandle = createElement('div', {
      className: 'event-resize-handle',
      title: 'Kéo chuột trái để thay đổi thời lượng (bước nhảy 15 phút)'
    });
    card.appendChild(resizeHandle);

    resizeHandle.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      e.preventDefault();

      const startY = e.clientY;
      const initialHeight = parseFloat(card.style.height) || (el.durMin / 60) * this.hourHeight;
      const initialDuration = el.durMin;
      const startAt = new Date(el.item.start_at);
      let curSnappedHeight = initialHeight;

      card.classList.add('event-resizing');

      const onMouseMove = (moveEvent) => {
        moveEvent.preventDefault();
        const deltaY = moveEvent.clientY - startY;
        const rawHeight = Math.max(15, initialHeight + deltaY);
        const pxPer15 = this.hourHeight / 4;
        curSnappedHeight = Math.max(pxPer15, Math.round(rawHeight / pxPer15) * pxPer15);
        card.style.height = `${curSnappedHeight - 2}px`;

        const curDurationMins = Math.round((curSnappedHeight / this.hourHeight) * 60);
        const tempEnd = new Date(startAt.getTime() + curDurationMins * 60000);
        const timeSpanEl = card.querySelector('.event-card-time');
        if (timeSpanEl) {
          timeSpanEl.textContent = `${formatDate(startAt, 'HH:mm')} - ${formatDate(tempEnd, 'HH:mm')}`;
        }
      };

      const onMouseUp = async () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        card.classList.remove('event-resizing');

        card.dataset.justResized = 'true';
        setTimeout(() => { card.dataset.justResized = 'false'; }, 200);

        const finalDurationMins = Math.max(15, Math.round((curSnappedHeight / this.hourHeight) * 60));

        if (finalDurationMins === initialDuration) {
          return;
        }

        const newEnd = new Date(startAt.getTime() + finalDurationMins * 60000);

        try {
          if (el.item.is_task) {
            await api.put(`/tasks/${el.item.id}`, {
              end_time: `${String(newEnd.getHours()).padStart(2, '0')}:${String(newEnd.getMinutes()).padStart(2, '0')}:00`,
              duration_minutes: finalDurationMins
            });
            Toast.success(`Đã cập nhật thời lượng: ${finalDurationMins} phút`);
            window.dispatchEvent(new CustomEvent('planify:data-changed', {
              detail: { source: 'calendar-week', action: 'resize', type: 'task', id: el.item.id }
            }));
            document.dispatchEvent(new CustomEvent('task-changed', {
              detail: { action: 'update', taskId: el.item.id }
            }));
          } else {
            await api.put(`/events/${el.item.id}`, {
              ...recurrenceContext(el.item),
              start_at: toLocalISOString(startAt),
              end_at: toLocalISOString(newEnd)
            });
            Toast.success(`Đã cập nhật thời lượng: ${finalDurationMins} phút`);
            window.dispatchEvent(new CustomEvent('planify:data-changed', {
              detail: { source: 'calendar-week', action: 'resize', type: 'event', id: el.item.id }
            }));
          }
          if (this.onRefresh) this.onRefresh();
        } catch (err) {
          Toast.error(err.message || 'Lỗi khi cập nhật thời lượng.');
          if (this.onRefresh) this.onRefresh();
        }
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });
  }

  attachDayColDrop(dayCol, targetDate) {
    dayCol.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      dayCol.classList.add('day-col-dragover');
    });

    dayCol.addEventListener('dragleave', (e) => {
      if (!dayCol.contains(e.relatedTarget)) {
        dayCol.classList.remove('day-col-dragover');
      }
    });

    dayCol.addEventListener('drop', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      dayCol.classList.remove('day-col-dragover');

      let data;
      try {
        data = JSON.parse(e.dataTransfer.getData('text/plain'));
      } catch (err) {
        return;
      }
      if (!data || !data.id) return;

      const rect = dayCol.getBoundingClientRect();
      const offsetY = Math.max(0, e.clientY - rect.top);
      const totalMinutes = (offsetY / this.hourHeight) * 60;
      const snappedMinutes = Math.min(23 * 60 + 45, Math.max(0, Math.round(totalMinutes / 15) * 15));
      const newHour = Math.floor(snappedMinutes / 60);
      const newMin = snappedMinutes % 60;

      const newStart = new Date(targetDate);
      newStart.setHours(newHour, newMin, 0, 0);
      const duration = data.durationMinutes || 60;
      const newEnd = new Date(newStart.getTime() + duration * 60000);

      try {
        if (data.is_task) {
          await api.put(`/tasks/${data.id}`, {
            due_date: formatDate(newStart, 'YYYY-MM-DD'),
            start_time: `${String(newHour).padStart(2, '0')}:${String(newMin).padStart(2, '0')}:00`,
            end_time: `${String(newEnd.getHours()).padStart(2, '0')}:${String(newEnd.getMinutes()).padStart(2, '0')}:00`,
            is_all_day: false,
            duration_minutes: duration
          });
          Toast.success(`Đã xếp công việc vào ${formatDate(newStart, 'HH:mm')}`);
          window.dispatchEvent(new CustomEvent('planify:data-changed', {
            detail: { source: 'calendar-week', action: 'move', type: 'task', id: data.id }
          }));
          document.dispatchEvent(new CustomEvent('task-changed', {
            detail: { action: 'update', taskId: data.id }
          }));
        } else {
          await api.put(`/events/${data.id}`, {
              ...recurrenceContext(data),
            start_at: toLocalISOString(newStart),
            end_at: toLocalISOString(newEnd)
          });
          Toast.success(`Đã dời công việc sang ${formatDate(newStart, 'HH:mm')}`);
          window.dispatchEvent(new CustomEvent('planify:data-changed', {
            detail: { source: 'calendar-week', action: 'move', type: 'event', id: data.id }
          }));
        }
        if (this.onRefresh) this.onRefresh();
      } catch (err) {
        Toast.error(err.message || 'Lỗi khi cập nhật thời gian.');
      }
    });
  }

  destroy() {
    if (this.timeIndicator) {
      this.timeIndicator.destroy();
      this.timeIndicator = null;
    }
  }
}
