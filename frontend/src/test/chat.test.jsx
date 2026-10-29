import { render,screen,waitFor,within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatView from '../chat/ChatView';
import { TaskProvider,useTasks } from '../tasks/TaskProvider';

const ok=data=>({ok:true,status:200,json:async()=>({data})});
const preview={id:1,title:'Học React',task_date:'2026-10-05',start_time:'09:00',end_time:'10:00'};
function mount(outputs){
  const fetcher=vi.fn(async path=>path==='/api/categories'?ok([]):path==='/api/chat/context'?ok({flow:null}):ok(outputs.shift()));
  vi.stubGlobal('fetch',fetcher);render(<TaskProvider><ChatView/></TaskProvider>);return fetcher;
}
async function send(text){await waitFor(()=>expect(screen.getByLabelText('Nội dung yêu cầu')).not.toBeDisabled());await userEvent.type(screen.getByLabelText('Nội dung yêu cầu'),text);await userEvent.click(screen.getByRole('button',{name:'Gửi yêu cầu'}));}

test('clarification carries backend context and choice uses whitelist ID',async()=>{
  const fetcher=mount([
    {type:'clarification',message:'Chọn công việc',mutated:false,context_id:'ctx',choices:[preview]},
    {type:'confirmation',message:'Xác nhận xóa?',mutated:false,context_id:'ctx',action:'delete_task',task_preview:preview},
    {type:'result',message:'Đã hủy',mutated:false,action:'cancel'},
  ]);
  await send('Xóa học React');
  await userEvent.click(await screen.findByRole('button',{name:/Học React/}));
  expect(await screen.findByText('Xác nhận xóa?')).toBeInTheDocument();
  expect(screen.getByLabelText('Nội dung yêu cầu')).toBeDisabled();
  expect(JSON.parse(fetcher.mock.calls.filter(([p])=>p==='/api/chat')[1][1].body)).toMatchObject({context_id:'ctx',selected_task_id:1});
  await userEvent.click(screen.getByText('Hủy yêu cầu'));
  expect(await screen.findByText('Đã hủy')).toBeInTheDocument();
  expect(screen.getByLabelText('Nội dung yêu cầu')).not.toBeDisabled();
  const confirm=fetcher.mock.calls.find(([p])=>p==='/api/chat/confirm');
  expect(JSON.parse(confirm[1].body)).toEqual({context_id:'ctx',decision:'cancel'});
});

test('mutated result refreshes shared data and expired flow clears confirm controls',async()=>{
  const fetcher=mount([
    {type:'result',message:'Đã tạo',action:'create_task',mutated:true,task:preview},
    {type:'confirmation',message:'Xóa?',action:'delete_task',mutated:false,context_id:'ctx',task_preview:preview},
  ]);
  await send('Tạo việc');expect(await screen.findByText('Đã tạo')).toBeInTheDocument();
  await waitFor(()=>expect(fetcher.mock.calls.filter(([p])=>p==='/api/categories')).toHaveLength(1));
  await send('Xóa việc');await screen.findByText('Xóa?');
  fetcher.mockImplementation(async path=>path==='/api/chat/confirm'?{ok:false,status:409,json:async()=>({error:{code:'CONTEXT_EXPIRED',message:'Ngữ cảnh hết hạn'}})}:ok([]));
  await userEvent.click(screen.getByText('Xác nhận xóa'));
  expect(await screen.findByRole('alert')).toHaveTextContent('hết hạn');
  expect(screen.queryByRole('button',{name:'Xác nhận xóa'})).not.toBeInTheDocument();
  expect(screen.getByLabelText('Nội dung yêu cầu')).not.toBeDisabled();
});

test.each([429,502,503])('provider HTTP %s preserves input, does not retry or refresh task data',async status=>{
  function ExistingTasks(){const {tasks}=useTasks({});return <output aria-label="Existing tasks">{tasks.map(t=>t.title).join(', ')}</output>;}
  const fetcher=vi.fn(async path=>path==='/api/chat'?
    {ok:false,status,json:async()=>({error:{code:'AI_UNAVAILABLE',message:'Trợ lý tạm không khả dụng'}})}:
    ok(path==='/api/tasks'?[preview]:[]));
  vi.stubGlobal('fetch',fetcher);
  render(<TaskProvider><ExistingTasks/><ChatView/></TaskProvider>);
  await waitFor(()=>expect(screen.getByLabelText('Existing tasks')).toHaveTextContent('Học React'));
  await send('Tạo việc mới');
  expect(await screen.findByRole('alert')).toHaveTextContent('tạm không khả dụng');
  expect(screen.getByLabelText('Nội dung yêu cầu')).toHaveValue('Tạo việc mới');
  expect(screen.getByLabelText('Nội dung yêu cầu')).not.toBeDisabled();
  expect(screen.getByLabelText('Existing tasks')).toHaveTextContent('Học React');
  expect(fetcher.mock.calls.filter(([p])=>p==='/api/chat')).toHaveLength(1);
  expect(fetcher.mock.calls.filter(([p])=>p==='/api/tasks')).toHaveLength(1);
  expect(fetcher.mock.calls.filter(([p])=>p==='/api/categories')).toHaveLength(1);
});

const availability={type:'availability',action:'suggest_free_slots',mutated:false,
  message:'Có các khung giờ phù hợp. Chưa tạo hay giữ chỗ.',
  criteria:{task_date:'2099-10-22',duration_minutes:90,start_time:'08:00',end_time:'18:00'},
  effective_start_time:'08:00',checked_at:'2099-10-21T10:00:00+07:00',has_more:true,
  slots:[{task_date:'2099-10-22',start_time:'08:00',end_time:'09:30'},
    {task_date:'2099-10-22',start_time:'10:00',end_time:'11:30'},
    {task_date:'2099-10-22',start_time:'13:00',end_time:'14:30'}]};

test('availability renders backend slots without booking controls or task refresh',async()=>{
  function ExistingTasks(){useTasks({});return null;}
  const fetcher=vi.fn(async path=>ok(path==='/api/chat'?availability:path==='/api/chat/context'?{flow:null}:[]));
  vi.stubGlobal('fetch',fetcher);
  render(<TaskProvider><ExistingTasks/><ChatView/></TaskProvider>);
  await send('Gợi ý 90 phút trống ngày mai từ 08:00 đến 18:00');
  const card=await screen.findByRole('region',{name:'Gợi ý giờ trống'});
  expect(within(card).getAllByRole('listitem')).toHaveLength(3);
  expect(within(card).getByText('08:00–09:30')).toBeInTheDocument();
  expect(card).toHaveTextContent('giờ Việt Nam');
  expect(card).toHaveTextContent('còn lựa chọn khác');
  expect(card).toHaveTextContent('Chưa giữ chỗ');
  expect(within(card).queryByRole('button')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Nội dung yêu cầu')).not.toBeDisabled();
  expect(fetcher.mock.calls.filter(([p])=>p==='/api/tasks')).toHaveLength(1);
  expect(fetcher.mock.calls.filter(([p])=>p==='/api/chat/confirm')).toHaveLength(0);
});

test('availability missing criteria keeps context and clears it after result',async()=>{
  const fetcher=mount([
    {type:'clarification',context_id:'free-time-draft',message:'Bạn muốn tìm trong khung giờ nào?',mutated:false,missing_fields:['start_time','end_time'],choices:[]},
    availability,
    {...availability,message:'Gợi ý cho lần tìm mới'},
  ]);
  await send('Ngày mai tôi cần 90 phút trống');
  await screen.findByText('Bạn muốn tìm trong khung giờ nào?');
  await send('Từ 08:00 đến 18:00');
  await screen.findByRole('region',{name:'Gợi ý giờ trống'});
  await send('Còn ngày kia thì sao?');
  await screen.findByText('Gợi ý cho lần tìm mới');
  const bodies=fetcher.mock.calls.filter(([p])=>p==='/api/chat').map(([,options])=>JSON.parse(options.body));
  expect(bodies[1].context_id).toBe('free-time-draft');
  expect(bodies[2].context_id).toBeNull();
});

test('empty availability and elapsed-today window are explicit, not a success mutation',async()=>{
  mount([{...availability,slots:[],has_more:false,effective_start_time:'16:31'}]);
  await send('Tìm giờ rảnh hôm nay');
  const card=await screen.findByRole('region',{name:'Gợi ý giờ trống'});
  expect(card).toHaveTextContent('chỉ xét từ 16:31');
  expect(card).toHaveTextContent('Không có khung giờ phù hợp');
  expect(within(card).queryByRole('list')).not.toBeInTheDocument();
});

test('free-time example fills input without silently sending a request',async()=>{
  const fetcher=mount([]);
  const text='Gợi ý 90 phút trống ngày mai từ 08:00 đến 18:00';
  await userEvent.click(screen.getByRole('button',{name:new RegExp(text)}));
  expect(screen.getByLabelText('Nội dung yêu cầu')).toHaveValue(text);
  expect(fetcher.mock.calls.filter(([p])=>p==='/api/chat')).toHaveLength(0);
});
