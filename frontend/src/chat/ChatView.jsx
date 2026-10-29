import { useEffect,useRef,useState } from 'react';
import { api } from '../api/client';
import Icon from '../components/Icon';
import { useTaskData } from '../tasks/TaskProvider';
import { dateLabel,timeLabel } from '../tasks/dates';

const suggestions=['Gợi ý 90 phút trống ngày mai từ 08:00 đến 18:00','Hôm nay tôi có những công việc nào?','Thêm học React ngày mai từ 19:00 đến 20:30'];
const actionLabels={create_task:'Tạo công việc',update_task:'Sửa công việc',delete_task:'Xóa công việc',complete_task:'Hoàn thành công việc'};
function TaskSummary({task,onOpen,categories=[]}) {
  const content=<><strong>{task.title}</strong><span>{dateLabel(task.task_date)} · {timeLabel(task)}</span>{task.priority&&<span>Ưu tiên: {({low:'Thấp',medium:'Vừa',high:'Cao'})[task.priority]} · {task.category_id?(categories.find(c=>c.id===task.category_id)?.name||'Chưa tải danh mục'):'Không phân loại'}</span>}{task.description&&<span>Ghi chú: {task.description}</span>}</>;
  return onOpen&&task.id?<button className="chat-task-summary summary-link" onClick={()=>onOpen(task.id)} aria-label={`Mở chi tiết ${task.title}`}>{content}</button>:<div className="chat-task-summary">{content}</div>;
}
function ChangePreview({before,after,categories}){
  const labels={title:'Tiêu đề',task_date:'Ngày',start_time:'Bắt đầu',end_time:'Kết thúc',priority:'Ưu tiên',category_id:'Danh mục',description:'Ghi chú'};
  const format=(key,value)=>key==='category_id'?(value?categories.find(c=>c.id===value)?.name||'Chưa tải danh mục':'Không phân loại'):key==='task_date'?dateLabel(value,true):key==='priority'?({low:'Thấp',medium:'Vừa',high:'Cao'})[value]:value||'Không có';
  return <dl className="change-diff">{Object.entries(labels).filter(([key])=>before[key]!==after[key]).map(([key,label])=><div key={key}><dt>{label}</dt><dd>{format(key,before[key])} → {format(key,after[key])}</dd></div>)}</dl>;
}
function AvailabilitySummary({result}){
  const {criteria,slots,has_more,effective_start_time}=result;
  return <section className="chat-availability" aria-label="Gợi ý giờ trống">
    <div className="availability-heading"><Icon name="calendar" size={18}/><strong>{dateLabel(criteria.task_date,true)} · {criteria.duration_minutes} phút</strong></div>
    <p className="availability-window">Khung tìm kiếm: {criteria.start_time}–{criteria.end_time} (giờ Việt Nam).</p>
    {effective_start_time&&effective_start_time!==criteria.start_time&&<p className="availability-window">Hôm nay chỉ xét từ {effective_start_time}, bỏ qua thời gian đã qua.</p>}
    {slots.length>0?<ol className="availability-slots">{slots.map(slot=><li key={`${slot.task_date}-${slot.start_time}`}><span>{slot.start_time}–{slot.end_time}</span></li>)}</ol>:<p className="availability-window">Không có khung giờ phù hợp trong phần thời gian còn lại.</p>}
    {has_more&&<p className="availability-window">Đây là 3 khung sớm nhất; còn lựa chọn khác.</p>}
    <small className="availability-note">Việc cả ngày/đã xong không chặn lịch. Chưa giữ chỗ. Tạo việc mới sẽ kiểm tra trùng lịch lại.</small>
  </section>;
}
export default function ChatView({onEdit,externalBusy=false,onBusyChange,active=true}) {
  const [messages,setMessages]=useState([]);
  const [input,setInput]=useState('');
  const [busy,setBusy]=useState(false);
  const [flow,setFlow]=useState(null);
  const [error,setError]=useState('');
  const [recovering,setRecovering]=useState(true);
  const [newMessages,setNewMessages]=useState(false);
  const [viewportHeight,setViewportHeight]=useState(window.visualViewport?.height||window.innerHeight);
  const {refresh,categories}=useTaskData();
  const bottom=useRef(null);
  const messagePanel=useRef(null),nearBottom=useRef(true),requestId=useRef(0);
  const pending=['confirmation','conflict'].includes(flow?.type);
  const locked=busy||externalBusy||recovering;
  function scrollDown(){bottom.current?.scrollIntoView?.({behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'nearest'});setNewMessages(false);}
  useEffect(()=>{if(!active)return;if(nearBottom.current)scrollDown();else setNewMessages(true);},[messages,busy,flow,active]);
  useEffect(()=>{const update=()=>setViewportHeight(window.visualViewport?.height||window.innerHeight);window.visualViewport?.addEventListener('resize',update);return()=>window.visualViewport?.removeEventListener('resize',update);},[]);
  useEffect(()=>{const controller=new AbortController();api('/chat/context',{signal:controller.signal}).then(data=>{if(controller.signal.aborted)return;setFlow(data?.flow||null);if(data?.flow)setMessages(old=>[...old,{role:'assistant',...data.flow}].slice(-80));}).catch(err=>{if(err.name!=='AbortError')setError('Chưa kiểm tra được yêu cầu đang chờ. '+err.message);}).finally(()=>{if(!controller.signal.aborted)setRecovering(false);});return()=>controller.abort();},[]);
  useEffect(()=>{onBusyChange?.(busy);return()=>onBusyChange?.(false);},[busy,onBusyChange]);
  const append=item=>setMessages(old=>[...old,item].slice(-80));
  async function recover(){if(busy)return;setRecovering(true);setError('');try{const data=await api('/chat/context');setFlow(data?.flow||null);if(data?.flow)append({role:'assistant',...data.flow});}catch(err){setError(err.message);}finally{setRecovering(false);}}
  async function openTask(id){if(!onEdit||locked||pending)return;try{const task=await api(`/tasks/${id}`);onEdit(task);}catch(err){setError(err.message);}}
  async function request(message,selectedTaskId=null,decision=null) {
    if(locked||(!decision&&pending))return;
    setBusy(true);setError('');
    const id=++requestId.current;
    nearBottom.current=true;
    if(!decision)append({role:'user',message,requestId:id,delivery:'sending'});
    try {
      const data=await api(decision?'/chat/confirm':'/chat',{method:'POST',body:decision?
        {context_id:flow.context_id,decision}:{message,context_id:flow?.context_id||null,selected_task_id:selectedTaskId}});
      setMessages(old=>[...old.map(item=>item.requestId===id?{...item,delivery:'sent'}:item),{role:'assistant',...data}].slice(-80));
      setFlow(data.context_id?data:null);setInput('');
      if(data.mutated)refresh();
    } catch(err) {
      const delay=Number(err.details?.retry_after_seconds);
      setError(err.message+(Number.isFinite(delay)&&delay>0?` Thử lại sau khoảng ${delay} giây.`:''));
      setMessages(old=>old.map(item=>item.requestId===id?{...item,delivery:'failed'}:item));
      if(['CONTEXT_EXPIRED','TASK_CHANGED'].includes(err.code))setFlow(null);
    } finally{setBusy(false);}
  }
  return <section className={`chat-layout${viewportHeight<620?' is-compact':''}`} aria-busy={locked} style={{'--visual-height':`${viewportHeight}px`}}>
    <div className="chat-panel"><header className="chat-heading"><span className="assistant-avatar"><Icon name="chat"/></span><div><strong>Trợ lý của nhịp</strong><small>Quản lý công việc và tìm giờ trống</small></div><span className="chat-heading-badge">AI</span></header>
      <div ref={messagePanel} onScroll={e=>{const el=e.currentTarget;nearBottom.current=el.scrollHeight-el.scrollTop-el.clientHeight<60;if(nearBottom.current)setNewMessages(false);}} className="messages" role="log" aria-live="polite" aria-label="Tin nhắn với trợ lý">
        {!messages.length&&<div className="chat-welcome"><h2>Bạn muốn sắp xếp việc gì?</h2><p>Nhập yêu cầu hoặc chọn một ví dụ bên dưới. Trợ lý sẽ hỏi lại khi cần thêm thông tin.</p><div className="chat-suggestions">{suggestions.map(text=><button key={text} onClick={()=>setInput(text)}>{text}<Icon name="arrow" size={15}/></button>)}</div></div>}
        {messages.map((item,index)=><div key={index} className={`message ${item.role}`}><span className="message-avatar">{item.role==='assistant'?'✳':'Bạn'}</span><div className="message-content"><p>{item.message}</p>
          {item.type==='draft'&&<div className="draft-notice">Bản nháp · chưa thực hiện</div>}
          {item.type==='availability'&&<AvailabilitySummary result={item}/>}
          {item.delivery==='failed'&&<small className="delivery-failed">Chưa nhận được kết quả. Kiểm tra Todo/yêu cầu đang chờ trước khi gửi lại.</small>}
          {item.task&&<TaskSummary task={item.task} categories={categories} onOpen={onEdit?openTask:undefined}/>}
          {item.tasks?.length>0&&<div className="chat-task-results">{item.tasks.slice(0,20).map(t=><TaskSummary key={t.id} task={t} categories={categories} onOpen={onEdit?openTask:undefined}/>)}{item.tasks.length>20&&<p>Còn {item.tasks.length-20} công việc. Hãy thu hẹp ngày/tên hoặc xem đầy đủ trong Todo.</p>}</div>}
        </div></div>)}
        {busy&&<div className="message assistant"><span className="message-avatar">✳</span><div className="thinking" role="status">Đang xem yêu cầu của bạn<span>•••</span></div></div>}
        <div ref={bottom}/>
      </div>
      {newMessages&&<button className="new-messages" onClick={scrollDown}>Xuống tin nhắn mới</button>}
      {flow?.choices?.length>0&&<div className="chat-flow"><p>Chọn công việc bạn muốn thao tác:</p><div className="chat-choices">{flow.choices.map(t=><button key={t.id} disabled={busy} onClick={()=>request(`Chọn công việc ${t.title}`,t.id)}><strong>{t.title}</strong><small>{dateLabel(t.task_date)} · {timeLabel(t)}</small></button>)}</div></div>}
      {pending&&<div className={`chat-flow ${flow.type==='conflict'?'chat-conflict':''}`}><span className="eyebrow">{actionLabels[flow.action]||'Xác nhận công việc'}</span><TaskSummary task={flow.task_preview} categories={categories}/>
        {flow.previous_task&&<ChangePreview before={flow.previous_task} after={flow.task_preview} categories={categories}/>}
        {flow.conflicting_tasks?.length>0&&<><p>Trùng với:</p>{flow.conflicting_tasks.map(t=><TaskSummary key={t.id} task={t}/>)}</>}
        <div className="modal-actions"><button disabled={busy} onClick={()=>request('',null,'cancel')}>Hủy yêu cầu</button><button className={flow.type==='conflict'?'primary':'danger'} disabled={busy} onClick={()=>request('',null,'confirm')}>{flow.type==='conflict'?'Vẫn tiếp tục':'Xác nhận xóa'}</button></div>
      </div>}
      {error&&<p className="alert error chat-error" role="alert">{error}</p>}
      <form className="chat-input" onSubmit={e=>{e.preventDefault();if(input.trim())request(input.trim());}}><label className="sr-only" htmlFor="chat-message">Nội dung yêu cầu</label><textarea id="chat-message" aria-describedby="chat-input-help" rows={2} maxLength={2000} value={input} disabled={locked||pending} onKeyDown={e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)&&!e.nativeEvent.isComposing){e.preventDefault();if(input.trim())request(input.trim());}}} onChange={e=>setInput(e.target.value)} placeholder={pending?'Xác nhận hoặc hủy yêu cầu ở trên…':flow?'Bổ sung thông tin cho yêu cầu…':'Ví dụ: Ngày mai thêm học React lúc 19h trong 90 phút'}/><button className="primary" aria-label="Gửi yêu cầu" disabled={locked||pending||!input.trim()}><Icon name="arrow"/></button></form>
      <div className="chat-footnote"><span id="chat-input-help">Enter xuống dòng · Ctrl/⌘ + Enter gửi · {input.length}/2000 ký tự.</span><span>Ngữ cảnh tối đa 10 phút không tương tác, không lưu lịch sử vào database. AI có thể hiểu sai; hãy kiểm tra kết quả.</span><button disabled={locked} className="text-button" onClick={recover}>{recovering?'Đang kiểm tra…':'Kiểm tra yêu cầu đang chờ'}</button>{flow&&!pending&&<button className="text-button" disabled={locked} onClick={()=>request('',null,'cancel')}>Bắt đầu yêu cầu khác</button>}</div>
    </div>
    <details className="chat-help"><summary>Cách diễn đạt yêu cầu</summary><div><p><strong>Tạo việc:</strong> “Học Python ngày mai từ 8h sáng đến 12h trưa.” Chỉ nêu ngày nếu muốn công việc cả ngày.</p><p><strong>Tìm và sửa:</strong> Nêu tên, ngày hoặc chọn công việc khi có nhiều kết quả.</p><p><strong>Giờ trống:</strong> “Gợi ý 90 phút trống ngày mai từ 08:00 đến 18:00.” Trợ lý cần ngày, thời lượng và khung tìm kiếm; chỉ gợi ý, không tự đặt lịch.</p><p><strong>Xác nhận:</strong> Xóa và giữ lịch trùng luôn cần bạn xác nhận. Ngữ cảnh hết hạn sau 10 phút không tương tác.</p></div></details>
  </section>;
}
