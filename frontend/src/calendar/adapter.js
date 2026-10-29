import { DateTime } from 'luxon';
import { addDays,TIMEZONE } from '../tasks/dates';

export function taskToEvent(task) {
  const timed=Boolean(task.start_time);
  return {id:String(task.id),title:task.title,allDay:!timed,
    start:timed?`${task.task_date}T${task.start_time}:00+07:00`:task.task_date,
    ...(timed?{end:`${task.task_date}T${task.end_time}:00+07:00`}:{}),
    classNames:[`event-${task.status}`,`event-priority-${task.priority}`],extendedProps:{task}};
}
export function calendarRange(startStr,endStr) {
  return {date_from:startStr.slice(0,10),date_to:addDays(endStr.slice(0,10),-1)};
}
export function selectionToForm(info) {
  const start=DateTime.fromISO(info.startStr,{zone:TIMEZONE});
  const end=DateTime.fromISO(info.endStr,{zone:TIMEZONE});
  if(!start.isValid||!end.isValid||end<=start)throw new Error('Khoảng thời gian không hợp lệ.');
  if(info.allDay){
    if(end.toISODate()!==start.plus({days:1}).toISODate())throw new Error('Hãy chọn một ngày. Công việc nhiều ngày chưa được hỗ trợ.');
    return {task_date:start.toISODate(),start_time:null,end_time:null};
  }
  if(start.toISODate()!==end.toISODate())throw new Error('Công việc phải bắt đầu và kết thúc trong cùng ngày.');
  return {task_date:start.toISODate(),start_time:start.toFormat('HH:mm'),end_time:end.toFormat('HH:mm')};
}
