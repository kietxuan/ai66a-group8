import { useCallback,useMemo,useRef,useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import luxonPlugin from '@fullcalendar/luxon3';
import viLocale from '@fullcalendar/core/locales/vi';
import { useTaskData,useTasks,useViewState } from '../tasks/TaskProvider';
import { TIMEZONE,today,dateLabel,timeLabel } from '../tasks/dates';
import { calendarRange,selectionToForm,taskToEvent } from './adapter';

export default function CalendarView({onCreate,onEdit,busy=false}) {
  const [saved,setSaved]=useViewState('calendar',{view:window.innerWidth<=760?'timeGridDay':'dayGridMonth',date:today()});
  const [range,setRange]=useState(null);
  const [filters,setFilters]=useViewState('calendarFilters',{});
  const calendar=useRef(null);
  const [selectionError,setSelectionError]=useState('');
  const {tasks,loading,error}=useTasks({...range,...filters},!!range);
  const {refresh,categories,categoryError,retryCategories}=useTaskData();
  const events=useMemo(()=>tasks.map(taskToEvent),[tasks]);
  const datesSet=useCallback(info=>{
    const next=calendarRange(info.startStr,info.endStr);
    setSelectionError('');
    setSaved(old=>({...old,view:info.view.type,date:today(info.view.calendar.getDate())}));
    setRange(old=>old?.date_from===next.date_from&&old?.date_to===next.date_to?old:next);
  },[setSaved]);
  return <section className="calendar-panel">
    <div className="calendar-note"><span>Giờ Việt Nam · UTC+7</span><span>Chọn ngày / khoảng giờ để thêm việc</span></div>
    <div className="calendar-tools"><label className="calendar-jump">Đến ngày<input type="date" value={saved.date} onChange={e=>{if(e.target.value)calendar.current?.getApi().gotoDate(e.target.value);}}/></label>
    <details className="calendar-filters"><summary>Lọc lịch</summary><div className="filter-grid"><label>Trạng thái lịch<select value={filters.status||''} onChange={e=>setFilters(old=>({...old,status:e.target.value}))}><option value="">Tất cả</option><option value="pending">Chưa xong</option><option value="completed">Đã xong</option></select></label><label>Danh mục lịch<select value={filters.category_id||''} onChange={e=>setFilters(old=>({...old,category_id:e.target.value}))}><option value="">Mọi danh mục</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><button onClick={()=>setFilters({})}>Đặt lại bộ lọc lịch</button></div></details></div>
    {categoryError&&<p className="alert error" role="alert">Chưa tải được danh mục. <button onClick={retryCategories}>Tải lại danh mục</button></p>}
    {selectionError&&<p className="alert error" role="alert">{selectionError}</p>}
    {error&&<div className="alert error" role="alert">{error} <button onClick={refresh}>Tải lại</button></div>}
    <div aria-busy={loading}>
      <FullCalendar ref={calendar} plugins={[dayGridPlugin,timeGridPlugin,interactionPlugin,luxonPlugin]} locale={viLocale} timeZone={TIMEZONE}
        initialView={saved.view} initialDate={saved.date} firstDay={1} height="auto" selectable={!busy} selectMirror
        editable={false} eventStartEditable={false} eventDurationEditable={false} nowIndicator dayMaxEvents={3}
        headerToolbar={{left:'prev,next today',center:'title',right:'dayGridMonth,timeGridWeek,timeGridDay'}}
        buttonIcons={false} buttonText={{prev:'‹',next:'›',today:'Hôm nay',month:'Tháng',week:'Tuần',day:'Ngày'}} allDayText="Cả ngày"
        slotMinTime="00:00:00" scrollTime="06:00:00" slotMaxTime="24:00:00" slotDuration="00:30:00"
        longPressDelay={500}
        eventTimeFormat={{hour:'2-digit',minute:'2-digit',hour12:false}}
        slotLabelFormat={{hour:'2-digit',minute:'2-digit',hour12:false}}
        datesSet={datesSet} events={events}
        select={info=>{try{setSelectionError('');onCreate(selectionToForm(info));}catch(err){setSelectionError(err.message);}info.view.calendar.unselect();}}
        dateClick={info=>{if(!busy&&info.allDay)onCreate({task_date:info.dateStr,start_time:null,end_time:null});}}
        eventClick={info=>{if(!busy)onEdit(info.event.extendedProps.task);}}
        eventDidMount={info=>{const task=info.event.extendedProps.task;const label=`${task.title}, ${dateLabel(task.task_date,true)}, ${timeLabel(task)}, ${task.status==='completed'?'đã hoàn thành':'chưa hoàn thành'}`;info.el.title=label;info.el.setAttribute('aria-label',label);}}
      />
    </div>
    <div className="calendar-legend"><span><i className="pending"/>Chưa hoàn thành</span><span><i className="completed"/>Đã hoàn thành</span>{loading&&<span role="status">Đang cập nhật lịch…</span>}</div>
  </section>;
}
