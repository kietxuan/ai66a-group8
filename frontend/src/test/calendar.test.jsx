import { DateTime } from 'luxon';
import { Calendar } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import luxonPlugin from '@fullcalendar/luxon3';
import { calendarRange,selectionToForm,taskToEvent } from '../calendar/adapter';
import { today } from '../tasks/dates';
import { render,screen,waitFor } from '@testing-library/react';
import { TaskProvider } from '../tasks/TaskProvider';
import CalendarView from '../calendar/CalendarView';

test('Vietnamese date near UTC midnight and inclusive range at year boundary',()=>{
  expect(today(new Date('2026-12-31T18:00:00Z'))).toBe('2027-01-01');
  expect(calendarRange('2026-12-28T00:00:00+07:00','2027-02-01T00:00:00+07:00')).toEqual({date_from:'2026-12-28',date_to:'2027-01-31'});
});
test.each(['America/Los_Angeles','UTC','Asia/Tokyo'])('adapter retains business slot with browser zone %s',zone=>{
  const event=taskToEvent({id:1,title:'Học',task_date:'2027-01-01',start_time:'00:30',end_time:'01:30',status:'pending',priority:'high'});
  expect(DateTime.fromISO(event.start,{zone}).setZone('Asia/Ho_Chi_Minh').toFormat('yyyy-MM-dd HH:mm')).toBe('2027-01-01 00:30');
  expect(taskToEvent({id:2,task_date:'2027-01-01',status:'completed'})).toMatchObject({allDay:true,start:'2027-01-01',classNames:['event-completed','event-priority-undefined']});
});
test('selection rejects overnight and multi-day, preserves calendar timezone',()=>{
  expect(selectionToForm({allDay:true,startStr:'2026-10-05',endStr:'2026-10-06'})).toEqual({task_date:'2026-10-05',start_time:null,end_time:null});
  expect(selectionToForm({allDay:false,startStr:'2026-10-05T09:00:00+07:00',endStr:'2026-10-05T10:30:00+07:00'})).toEqual({task_date:'2026-10-05',start_time:'09:00',end_time:'10:30'});
  expect(()=>selectionToForm({allDay:true,startStr:'2026-10-05',endStr:'2026-10-07'})).toThrow('một ngày');
  expect(()=>selectionToForm({allDay:false,startStr:'2026-10-05T23:00:00+07:00',endStr:'2026-10-06T01:00:00+07:00'})).toThrow('cùng ngày');
});
test('actual pinned FullCalendar plugin resolves named zone without UTC coercion',()=>{
  const el=document.createElement('div');document.body.append(el);
  const calendar=new Calendar(el,{plugins:[dayGridPlugin,luxonPlugin],timeZone:'Asia/Ho_Chi_Minh',initialDate:'2026-10-05',events:[{id:'1',start:'2026-10-05T09:00:00+07:00',end:'2026-10-05T10:00:00+07:00'}]});
  calendar.render();
  expect(calendar.getEventById('1').startStr).toBe('2026-10-05T09:00:00+07:00');
  expect(calendar.getEventById('1').start.toISOString()).toBe('2026-10-05T02:00:00.000Z');
  calendar.destroy();el.remove();
});

test('actual CalendarView mounts narrow day view, includes midnight and avoids initial today request',async()=>{
  const oldWidth=window.innerWidth;
  Object.defineProperty(window,'innerWidth',{value:390,configurable:true});
  const fetcher=vi.fn(async()=>({ok:true,status:200,json:async()=>({data:[]})}));
  vi.stubGlobal('fetch',fetcher);
  try{
    const view=render(<TaskProvider><CalendarView onCreate={vi.fn()} onEdit={vi.fn()}/></TaskProvider>);
    await waitFor(()=>expect(document.querySelector('[data-time="00:00:00"]')).toBeInTheDocument());
    await waitFor(()=>expect(fetcher.mock.calls.some(([path])=>path.includes('/tasks?date_from='))).toBe(true));
    expect(fetcher.mock.calls.some(([path])=>path.includes('/tasks?task_date='))).toBe(false);
    expect(screen.getByLabelText('Đến ngày')).toHaveValue(today());
    view.unmount();
  }finally{Object.defineProperty(window,'innerWidth',{value:oldWidth,configurable:true});}
});
