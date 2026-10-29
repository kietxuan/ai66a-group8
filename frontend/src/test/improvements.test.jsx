import { act,render,screen,waitFor,within,fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api,changeSession } from '../api/client';
import { TaskProvider,useTaskData,useTasks } from '../tasks/TaskProvider';
import Workspace from '../tasks/Workspace';
import ChatView from '../chat/ChatView';
import AuthScreen from '../auth/AuthScreen';
import TaskForm from '../tasks/TaskForm';
import App from '../App';

const ok=data=>({ok:true,status:200,json:async()=>({data})});
const task={id:1,title:'Học React',task_date:'2026-10-22',start_time:'08:00',end_time:'12:00',description:null,priority:'medium',category_id:null,status:'pending',updated_at:'2026-10-21T01:00:00+00:00'};
function deferred(){let resolve;return {promise:new Promise(r=>{resolve=r;}),resolve:value=>resolve(value)};}

test.each(['headers','body'])('deadline covers hanging response %s and never retries',async stage=>{
  const hanging=new Promise(()=>{});
  const fetcher=vi.fn(()=>stage==='headers'?hanging:Promise.resolve({ok:true,status:200,json:()=>hanging}));
  vi.stubGlobal('fetch',fetcher);
  await expect(api('/tasks',{method:'POST',body:{},timeoutMs:10})).rejects.toMatchObject({code:'REQUEST_TIMEOUT'});
  expect(fetcher).toHaveBeenCalledTimes(1);
});

test('late 401 from previous session cannot log out a new session, including delayed JSON',async()=>{
  const body=deferred(),expired=vi.fn();
  window.addEventListener('session-expired',expired);
  vi.stubGlobal('fetch',vi.fn(async()=>({ok:false,status:401,json:()=>body.promise})));
  const request=api('/tasks').catch(e=>e);
  changeSession();body.resolve({error:{message:'Expired',code:'UNAUTHENTICATED'}});
  expect((await request).status).toBe(401);
  expect(expired).not.toHaveBeenCalled();window.removeEventListener('session-expired',expired);
});

test('non-JSON error gets safe message instead of parser exception',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>({ok:false,status:500,json:async()=>{throw new SyntaxError('private response');}})));
  await expect(api('/tasks')).rejects.toMatchObject({code:'INVALID_RESPONSE'});
});

test('refresh retains same-query snapshot and does not refetch read-only categories',async()=>{
  const next=deferred();let reads=0;
  const fetcher=vi.fn(path=>path==='/api/categories'?Promise.resolve(ok([])):reads++===0?Promise.resolve(ok([task])):next.promise);
  vi.stubGlobal('fetch',fetcher);
  function Probe(){const {refresh}=useTaskData();const {tasks,loading}=useTasks({});return <><button onClick={refresh}>Refresh</button><output>{tasks.map(t=>t.title).join(',')}{loading?' Updating':''}</output></>;}
  render(<TaskProvider><Probe/></TaskProvider>);
  await screen.findByText('Học React');await userEvent.click(screen.getByText('Refresh'));
  expect(screen.getByText('Học React Updating')).toBeInTheDocument();
  await act(async()=>next.resolve(ok([task])));
  expect(fetcher.mock.calls.filter(([p])=>p==='/api/categories')).toHaveLength(1);
});

test('invalid filter range does not fetch tasks or leave a permanent loading state',async()=>{
  const fetcher=vi.fn(async()=>ok([]));vi.stubGlobal('fetch',fetcher);
  function Probe(){const state=useTasks({date_from:'2026-10-22',date_to:'2026-10-21'},false);return <output>{state.loading?'Loading':'Idle'}</output>;}
  render(<TaskProvider><Probe/></TaskProvider>);
  expect(await screen.findByText('Idle')).toBeInTheDocument();
  expect(fetcher.mock.calls.some(([path])=>path.startsWith('/api/tasks'))).toBe(false);
});

test('task form prevents dirty close, restores draft and rejects status network failure safely',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>ok([])));
  const close=vi.fn();
  render(<TaskProvider><TaskForm task={task} onClose={close} onSave={vi.fn()} onStatus={async()=>{throw new Error('Status unavailable');}} onDelete={vi.fn()} busy={false}/></TaskProvider>);
  await userEvent.click(screen.getByText('Đánh dấu hoàn thành'));
  expect(await screen.findByRole('alert')).toHaveTextContent('Status unavailable');
  await userEvent.type(screen.getByLabelText('Tiêu đề'),' mới');
  await userEvent.click(screen.getByText('Hủy'));
  expect(await screen.findByText('Bỏ thay đổi chưa lưu?')).toBeInTheDocument();
  expect(close).not.toHaveBeenCalled();
  await userEvent.click(screen.getByText('Tiếp tục sửa'));
  expect(screen.getByLabelText('Tiêu đề')).toHaveValue('Học React mới');
});

test('saving locks inputs and task edit carries expected version',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>ok([])));
  const save=vi.fn();const view=render(<TaskProvider><TaskForm task={task} onClose={vi.fn()} onSave={save} busy={false}/></TaskProvider>);
  await userEvent.click(screen.getByText('Lưu thay đổi'));
  expect(save.mock.calls[0][0].expected_version).toBe(task.updated_at);
  view.rerender(<TaskProvider><TaskForm task={task} onClose={vi.fn()} onSave={save} busy/></TaskProvider>);
  expect(screen.getByLabelText('Tiêu đề')).toBeDisabled();
});

test('task field error is associated with the invalid input',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>ok([])));
  render(<TaskProvider><TaskForm onClose={vi.fn()} onSave={vi.fn()} busy={false}/></TaskProvider>);
  await userEvent.click(screen.getByText('Thêm công việc'));
  const title=screen.getByLabelText('Tiêu đề');
  expect(title).toHaveAttribute('aria-invalid','true');
  expect(title).toHaveAccessibleDescription('Hãy nhập tiêu đề công việc.');
  expect(title).toHaveFocus();
});

test('auth password toggle starts masked and unicode byte limit does not send',async()=>{
  const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
  render(<AuthScreen onLogin={vi.fn()}/>);
  expect(screen.getByLabelText('Mật khẩu')).toHaveAttribute('type','password');
  await userEvent.click(screen.getByText('Hiện mật khẩu'));
  expect(screen.getByLabelText('Mật khẩu')).toHaveAttribute('type','text');
  await userEvent.type(screen.getByLabelText('Email'),'a@example.com');
  await userEvent.type(screen.getByLabelText('Mật khẩu'),'ệ'.repeat(25));
  await userEvent.click(screen.getByText('Đăng nhập →'));
  expect(await screen.findByRole('alert')).toHaveTextContent('72 byte');expect(fetcher).not.toHaveBeenCalled();
});

test('chat recovers server-owned pending and cancel cannot supply action',async()=>{
  const pending={type:'confirmation',message:'Waiting',context_id:'live',action:'delete_task',task_preview:task};
  const fetcher=vi.fn(async(path,options)=>path==='/api/categories'?ok([]):path==='/api/chat/context'?ok({flow:pending}):ok({type:'result',action:'cancel',message:'Cancelled',mutated:false}));
  vi.stubGlobal('fetch',fetcher);render(<TaskProvider><ChatView/></TaskProvider>);
  await screen.findByText('Xác nhận xóa');
  expect(screen.getByLabelText('Nội dung yêu cầu')).toBeDisabled();
  await userEvent.click(screen.getByText('Hủy yêu cầu'));
  const call=fetcher.mock.calls.find(([p])=>p==='/api/chat/confirm');
  expect(JSON.parse(call[1].body)).toEqual({context_id:'live',decision:'cancel'});
  expect(await screen.findByText('Cancelled')).toBeInTheDocument();
});

test('failed chat bubble is marked and retry-after is visible without retry',async()=>{
  const fetcher=vi.fn(async path=>path==='/api/chat'?{ok:false,status:429,json:async()=>({error:{code:'AI_RATE_LIMITED',message:'Chờ',details:{retry_after_seconds:12}}})}:path==='/api/chat/context'?ok({flow:null}):ok([]));
  vi.stubGlobal('fetch',fetcher);render(<TaskProvider><ChatView/></TaskProvider>);
  await waitFor(()=>expect(screen.getByLabelText('Nội dung yêu cầu')).not.toBeDisabled());
  await userEvent.type(screen.getByLabelText('Nội dung yêu cầu'),'Tạo việc');await userEvent.click(screen.getByLabelText('Gửi yêu cầu'));
  expect(await screen.findByRole('alert')).toHaveTextContent('12 giây');
  expect(screen.getByText(/Chưa nhận được kết quả/)).toBeInTheDocument();
  expect(fetcher.mock.calls.filter(([p])=>p==='/api/chat')).toHaveLength(1);
});

test('IME composition does not submit Ctrl+Enter',async()=>{
  const fetcher=vi.fn(async path=>path==='/api/chat/context'?ok({flow:null}):ok([]));vi.stubGlobal('fetch',fetcher);
  render(<TaskProvider><ChatView/></TaskProvider>);
  await waitFor(()=>expect(screen.getByLabelText('Nội dung yêu cầu')).not.toBeDisabled());
  const input=screen.getByLabelText('Nội dung yêu cầu');await userEvent.type(input,'Ngày mai');
  fireEvent.keyDown(input,{key:'Enter',ctrlKey:true,isComposing:true});
  expect(fetcher.mock.calls.filter(([p])=>p==='/api/chat')).toHaveLength(0);
});

test('recovered clarification shows the actual question instead of only a placeholder',async()=>{
  const flow={type:'clarification',message:'Bạn muốn xếp việc vào ngày nào?',context_id:'draft',missing_fields:['task_date'],choices:[],mutated:false};
  const fetcher=vi.fn(async path=>path==='/api/chat/context'?ok({flow}):ok([]));vi.stubGlobal('fetch',fetcher);
  render(<TaskProvider><ChatView/></TaskProvider>);
  expect(await screen.findByText('Bạn muốn xếp việc vào ngày nào?')).toBeInTheDocument();
  expect(screen.getByLabelText('Nội dung yêu cầu')).toBeEnabled();
  expect(fetcher.mock.calls.some(([,options])=>options.method==='POST')).toBe(false);
});

test('starting another request cancels the draft on the server rather than only hiding its ID',async()=>{
  const flow={type:'clarification',message:'Ngày nào?',context_id:'draft',missing_fields:['task_date'],choices:[],mutated:false};
  const fetcher=vi.fn(async path=>path==='/api/chat/context'?ok({flow}):path==='/api/chat/confirm'?ok({type:'result',action:'cancel',message:'Đã hủy bản nháp',mutated:false}):ok([]));
  vi.stubGlobal('fetch',fetcher);render(<TaskProvider><ChatView/></TaskProvider>);
  await userEvent.click(await screen.findByText('Bắt đầu yêu cầu khác'));
  const call=fetcher.mock.calls.find(([path])=>path==='/api/chat/confirm');
  expect(JSON.parse(call[1].body)).toEqual({context_id:'draft',decision:'cancel'});
  expect(await screen.findByText('Đã hủy bản nháp')).toBeInTheDocument();
});

test('logout failure keeps workspace usable and never pretends success',async()=>{
  vi.stubGlobal('fetch',vi.fn(async path=>{
    if(path==='/api/auth/logout')throw new TypeError('Offline');
    return path==='/api/auth/me'?ok({id:1,name:'Owner'}):path==='/api/chat/context'?ok({flow:null}):ok([]);
  }));
  render(<App/>);await screen.findByText('Owner');await userEvent.click(screen.getByLabelText('Đăng xuất'));
  expect(await screen.findByRole('alert')).toHaveTextContent('Chưa đăng xuất');
  expect(screen.getByRole('button',{name:'Thêm công việc'})).toBeEnabled();
  expect(screen.queryByText('Rất vui được gặp lại')).not.toBeInTheDocument();
});
