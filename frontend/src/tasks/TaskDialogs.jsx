import { useEffect,useState } from 'react';
import Modal from '../components/Modal';
import TaskForm from './TaskForm';
import { useTaskData } from './TaskProvider';
import { dateLabel,timeLabel } from './dates';

export default function TaskDialogs({editor,setEditor,deleting,setDeleting,conflict,setConflict,busy,setBusy,run,onNotice}) {
  const [error,setError]=useState('');
  const {mutate}=useTaskData();
  useEffect(()=>setError(''),[editor,deleting,conflict]);
  async function proceed() {
    if(busy)return;setBusy(true);setError('');
    try {await mutate(conflict.operation,conflict.id,conflict.body,true);setConflict(null);setEditor(null);onNotice?.('Đã lưu công việc theo lựa chọn giữ lịch trùng.');}
    catch(err){setError(err.message);}
    finally{setBusy(false);}
  }
  async function remove() {
    setError('');
    try {await run('delete',deleting.id,{expected_version:deleting.updated_at});setDeleting(null);setEditor(null);}
    catch(err){setError(err.message);}
  }
  return <>
    {editor&&<TaskForm task={editor.task} initial={editor.initial} busy={busy} onClose={()=>setEditor(null)}
      onSave={body=>run(editor.task?'update':'create',editor.task?.id,body,body)}
      onStatus={task=>run('status',task.id,{status:task.status==='completed'?'pending':'completed',expected_version:task.updated_at},task)} onDelete={setDeleting}/>}
    {deleting&&<Modal title="Xóa công việc này?" onClose={()=>{setDeleting(null);setError('');}} busy={busy}>
      <p><strong>{deleting.title}</strong></p><p className="muted">{dateLabel(deleting.task_date,true)} · {timeLabel(deleting)}</p><p>Công việc sẽ được xóa khỏi danh sách và lịch của bạn.</p>
      {error&&<p role="alert" className="alert error">{error}</p>}
      <div className="modal-actions"><button disabled={busy} onClick={()=>setDeleting(null)}>Giữ lại</button><button className="danger" disabled={busy} onClick={remove}>Xác nhận xóa</button></div>
    </Modal>}
    {conflict&&<Modal title="Khoảng thời gian này đã có kế hoạch" busy={busy} onClose={()=>{setConflict(null);setError('');}}>
      <p><strong>{conflict.preview?.title}</strong> · {timeLabel(conflict.preview||{})}</p>
      <p className="muted">Bạn có thể điều chỉnh giờ hoặc chủ động giữ các công việc trùng nhau.</p>
      <ul className="conflict-list">{conflict.tasks.map(t=><li key={t.id}><strong>{t.title}</strong><span>{dateLabel(t.task_date)} · {timeLabel(t)}</span></li>)}</ul>
      {error&&<p role="alert" className="alert error">{error}</p>}
      <div className="modal-actions"><button disabled={busy} onClick={()=>setConflict(null)}>{editor?'Đổi giờ / Hủy':'Hủy mở lại'}</button><button className="primary" disabled={busy} onClick={proceed}>Vẫn tiếp tục</button></div>
    </Modal>}
  </>;
}
