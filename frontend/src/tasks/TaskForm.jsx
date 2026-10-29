import { useEffect,useId,useRef,useState } from 'react';
import Modal from '../components/Modal';
import { useTaskData } from './TaskProvider';
import { today } from './dates';

export default function TaskForm({task,initial={},onSave,onClose,onStatus,onDelete,busy}) {
  const {categories,categoryError,retryCategories}=useTaskData();
  const [values,setValues]=useState({title:'',description:'',task_date:today(),start_time:'',end_time:'',priority:'medium',category_id:'',...initial,
    ...(task ? {...task,description:task.description||'',start_time:task.start_time||'',end_time:task.end_time||'',category_id:task.category_id||''} : {})});
  const [allDay,setAllDay]=useState(!values.start_time);
  const [error,setError]=useState('');
  const [fieldErrors,setFieldErrors]=useState({});
  const [closing,setClosing]=useState(false);
  const baseline=useRef(JSON.stringify({values,allDay}));
  const formRef=useRef(null),errorId=useId();
  useEffect(()=>{if(error&&!busy){const field=Object.keys(fieldErrors)[0];if(field)formRef.current?.elements.namedItem(field)?.focus();}},[error,busy,fieldErrors]);
  const dirty=baseline.current!==JSON.stringify({values,allDay});
  const close=()=>{if(!busy){if(dirty)setClosing(true);else onClose();}};
  const a11y=name=>({'aria-invalid':fieldErrors[name]?true:undefined,'aria-describedby':fieldErrors[name]?errorId:undefined});
  function fail(message,fields){setError(message);setFieldErrors(Object.fromEntries(fields.map(k=>[k,true])));formRef.current?.elements.namedItem(fields[0])?.focus();}
  const update=e=>setValues(v=>({...v,[e.target.name]:e.target.value}));
  async function submit(e) {
    e.preventDefault();if(busy)return;setError('');setFieldErrors({});
    if (!values.title.trim()) {fail('Hãy nhập tiêu đề công việc.',['title']);return;}
    if(!values.task_date){fail('Hãy chọn ngày cho công việc.',['task_date']);return;}
    if (!allDay && (!values.start_time || !values.end_time || values.end_time<=values.start_time)) {
      fail('Cần đủ hai giờ và giờ kết thúc phải sau giờ bắt đầu.',['start_time','end_time']);return;
    }
    const body={title:values.title.trim(),description:values.description||null,task_date:values.task_date,
      start_time:allDay?null:values.start_time,end_time:allDay?null:values.end_time,priority:values.priority,
      category_id:values.category_id?Number(values.category_id):null,...(task?.updated_at?{expected_version:task.updated_at}:{})};
    try {await onSave(body);} catch(err) {fail(err.message,(err.details?.fields||[]).map(f=>f.field.split('.').at(-1)));}
  }
  async function status(){try{await onStatus(task);}catch(err){setError(err.message);}}
  return <><Modal title={task?'Chi tiết công việc':'Tạo công việc mới'} onClose={close} busy={busy} wide panel>
    <p className="modal-description">{task?'Xem và cập nhật thông tin công việc.':'Nhập tên, ngày và thời gian nếu cần.'}</p>
    <form ref={formRef} onSubmit={submit} noValidate aria-busy={busy}>
      <fieldset disabled={busy} className="form-fields">
      <label>Tiêu đề<input name="title" value={values.title} onChange={update} required maxLength={200} {...a11y('title')} placeholder="Bạn muốn làm điều gì?" /></label>
      <label>Ghi chú<textarea name="description" value={values.description} onChange={update} rows={3} maxLength={2000} placeholder="Thêm một chút chi tiết (không bắt buộc)" /></label>
      <div className="form-row"><label>Ngày<input name="task_date" type="date" value={values.task_date} onChange={update} required {...a11y('task_date')}/></label>
        <label className="checkbox-label"><input type="checkbox" checked={allDay} onChange={e=>setAllDay(e.target.checked)}/> Cả ngày</label></div>
      {!allDay&&<div className="form-row"><label>Bắt đầu<input name="start_time" type="time" step="60" required value={values.start_time} onChange={update} {...a11y('start_time')}/></label>
        <label>Kết thúc<input name="end_time" type="time" step="60" required value={values.end_time} onChange={update} {...a11y('end_time')}/></label></div>}
      <div className="form-row"><label>Ưu tiên<select name="priority" value={values.priority} onChange={update}><option value="low">Thấp</option><option value="medium">Vừa</option><option value="high">Cao</option></select></label>
        <label>Danh mục<select name="category_id" value={values.category_id} onChange={update}><option value="">Không phân loại</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label></div>
      {categoryError&&<p className="alert error" role="alert">Chưa tải được danh mục: {categoryError} <button type="button" onClick={retryCategories}>Tải lại danh mục</button></p>}
      {error&&<p id={errorId} className="alert error" role="alert">{error}</p>}
      {task&&<div className="task-detail-actions"><button type="button" disabled={busy||dirty} title={dirty?'Lưu hoặc hủy các thay đổi trước':''} onClick={status}>{task.status==='completed'?'Mở lại công việc':'Đánh dấu hoàn thành'}</button><button type="button" className="danger-text" disabled={busy} onClick={()=>onDelete(task)}>Xóa công việc</button></div>}
      <div className="modal-actions"><button type="button" disabled={busy} onClick={close}>Hủy</button><button className="primary" disabled={busy}>{busy?'Đang lưu…':task?'Lưu thay đổi':'Thêm công việc'}</button></div>
      </fieldset>
    </form>
  </Modal>{closing&&<Modal title="Bỏ thay đổi chưa lưu?" onClose={()=>setClosing(false)} description="Nội dung bạn vừa nhập chưa được lưu. Bạn có thể quay lại để tiếp tục sửa."><div className="modal-actions"><button onClick={()=>setClosing(false)}>Tiếp tục sửa</button><button className="danger" onClick={onClose}>Bỏ thay đổi</button></div></Modal>}</>;
}
