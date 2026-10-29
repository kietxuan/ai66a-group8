import { lazy,Suspense,useEffect,useState } from 'react';
import ErrorBoundary from '../components/ErrorBoundary';
import Icon from '../components/Icon';
import ThemeToggle from '../components/ThemeToggle';
import { useTaskData } from './TaskProvider';
import { dateLabel,today } from './dates';
import TodoView from './TodoView';
import TaskDialogs from './TaskDialogs';
import ChatView from '../chat/ChatView';

const CalendarView=lazy(()=>import('../calendar/CalendarView'));

export default function Workspace({user,onLogout,logoutError,loggingOut}) {
  const readView=()=>({ '/calendar':'calendar','/chat':'chat' }[location.pathname]||'todo');
  const [view,setView]=useState(readView);
  const [date,setDate]=useState(today);
  const [chatBusy,setChatBusy]=useState(false);
  useEffect(()=>{const pop=()=>setView(readView());window.addEventListener('popstate',pop);const timer=setInterval(()=>setDate(today()),30000);return()=>{window.removeEventListener('popstate',pop);clearInterval(timer);};},[]);
  const navigate=key=>{setView(key);history.pushState(null,'',key==='todo'?'/':`/${key}`);};
  const [editor,setEditor]=useState(null);
  const [deleting,setDeleting]=useState(null);
  const [conflict,setConflict]=useState(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const {mutate,refresh,viewState}=useTaskData();
  const selectedDate=viewState.todoFilters?.task_date||(viewState.todoFilters?.date_from&&viewState.todoFilters.date_from===viewState.todoFilters.date_to?viewState.todoFilters.date_from:date);
  const locked=busy||chatBusy;
  const edit=task=>{setError('');setEditor({task});};
  const create=(initial={})=>{setError('');setEditor({initial});};
  async function run(operation,id,body,preview) {
    if(locked)return;setBusy(true);setError('');setNotice('');
    try {const saved=await mutate(operation,id,body);setEditor(null);setNotice(operation==='create'?'Đã thêm công việc.':operation==='delete'?'Đã xóa công việc.':saved?.updated_at&&saved.updated_at===body?.expected_version?'Không có thay đổi mới.':operation==='status'?(body.status==='completed'?'Đã đánh dấu hoàn thành.':'Đã mở lại công việc.'):'Đã lưu thông tin công việc.');return saved;}
    catch(err) {
      if(err.code==='TASK_CONFLICT')setConflict({operation,id,body,preview,tasks:err.details.conflicting_tasks});
      else {if(err.code==='TASK_CHANGED')refresh();setError(err.message);throw err;}
    } finally{setBusy(false);}
  }
  const status=task=>run('status',task.id,{status:task.status==='completed'?'pending':'completed',expected_version:task.updated_at},task).catch(()=>{});
  return <div className={`app-layout${editor?' has-editor':''}${view==='chat'?' is-chat-view':''}`}>
    <a className="skip-link" href="#main-content">Đến nội dung chính</a>
    <aside className="sidebar"><a className="brand" href="/" aria-label="Nhịp — Công việc">nhịp<span>✳</span></a>
      <nav aria-label="Điều hướng chính">{[['todo','list','Công việc'],['calendar','calendar','Lịch của tôi'],['chat','chat','Trợ lý AI']].map(([key,icon,label])=><button key={key} aria-label={label} title={label} aria-current={view===key?'page':undefined} className={view===key?'active':''} onClick={()=>navigate(key)}><Icon name={icon}/><span className="nav-label">{label}</span></button>)}</nav>
      <div className="user-area"><span className="avatar">{user.name.slice(0,1).toUpperCase()}</span><div><strong>{user.name}</strong><small>Tài khoản cá nhân</small></div><button className="icon-button" aria-label="Đăng xuất" disabled={loggingOut||locked} onClick={onLogout}><Icon name="logout" size={17}/></button></div>
    </aside>
    <main className="workspace" id="main-content" tabIndex={-1}><header className="topbar"><span className="topbar-date">{dateLabel(date,true)}</span><div className="topbar-actions"><span className="topbar-account">Không gian cá nhân</span><ThemeToggle/></div></header>
      <div className="workspace-content"><div className="page-heading"><div><h1>{view==='todo'?'Công việc':view==='calendar'?'Lịch của tôi':'Trợ lý AI'}</h1><p>{view==='todo'?'Những việc cần làm, trong tầm tay.':view==='calendar'?'Theo dõi và sắp xếp lịch của bạn.':'Quản lý công việc bằng ngôn ngữ tự nhiên.'}</p></div>
        <button className="primary new-task" disabled={locked} onClick={()=>create(view==='calendar'?{}:{task_date:selectedDate})}><Icon name="plus" size={18}/>Thêm công việc</button></div>
      {logoutError&&<p className="alert error" role="alert">Chưa đăng xuất: {logoutError} Bạn vẫn đang trong phiên hiện tại.</p>}
      {error&&<div className="alert error" role="alert">{error}</div>}{notice&&<div className="success-toast" role="status">✓ {notice}<button aria-label="Ẩn thông báo" onClick={()=>setNotice('')}>×</button></div>}
      {view==='todo'&&<TodoView onEdit={edit} onDelete={setDeleting} onStatus={status} busy={locked} businessDate={date}/>}
      {view==='calendar'&&<ErrorBoundary><Suspense fallback={<div className="empty-state" role="status">Đang mở lịch…</div>}><CalendarView onEdit={edit} onCreate={create} busy={locked}/></Suspense></ErrorBoundary>}
      <div hidden={view!=='chat'}><ChatView active={view==='chat'} onEdit={edit} externalBusy={busy} onBusyChange={setChatBusy}/></div>
      </div>
    </main>
    <TaskDialogs editor={editor} setEditor={setEditor} deleting={deleting} setDeleting={setDeleting} conflict={conflict} setConflict={setConflict} busy={locked} setBusy={setBusy} run={run} onNotice={setNotice}/>
  </div>;
}
