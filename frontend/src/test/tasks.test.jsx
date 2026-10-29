import { render,screen,waitFor,within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TaskProvider } from '../tasks/TaskProvider';
import Workspace from '../tasks/Workspace';
import { today } from '../tasks/dates';

const task={id:1,title:'Học React',task_date:'2026-10-05',start_time:'09:00',end_time:'10:00',description:null,priority:'medium',category_id:null,status:'pending'};
function mount(fetcher) {
  vi.stubGlobal('fetch',fetcher);
  return render(<TaskProvider><Workspace user={{id:1,name:'An'}} onLogout={()=>{}}/></TaskProvider>);
}
const ok=data=>({ok:true,status:200,json:async()=>({data})});

test('create all-day sends null pair and refreshes shared list',async()=>{
  let tasks=[];
  const fetcher=vi.fn(async(path,options)=>{
    if(options.method==='POST'){tasks=[{...task,...JSON.parse(options.body)}];return ok(tasks[0]);}
    return ok(path==='/api/categories'?[]:tasks);
  });mount(fetcher);
  await userEvent.click(screen.getByRole('button',{name:'Thêm công việc'}));
  await userEvent.type(screen.getByLabelText('Tiêu đề'),'Việc mới');
  await userEvent.click(screen.getAllByRole('button',{name:'Thêm công việc',exact:true})[1]);
  expect(await screen.findByText('Việc mới')).toBeInTheDocument();
  const mutation=fetcher.mock.calls.find(([,o])=>o.method==='POST');
  expect(JSON.parse(mutation[1].body)).toMatchObject({start_time:null,end_time:null,allow_conflict:false});
});

test('delete cancellation and conflict reopen do not mutate; override is explicit',async()=>{
  let writes=0;
  const fetcher=vi.fn(async(path,options)=>{
    if(options.method==='PATCH'){
      writes++;
      if(!JSON.parse(options.body).allow_conflict)return {ok:false,status:409,json:async()=>({error:{code:'TASK_CONFLICT',message:'Trùng lịch',details:{conflicting_tasks:[task]}}})};
      return ok(task);
    }
    return ok(path==='/api/categories'?[]:[{...task,status:'completed'}]);
  });mount(fetcher);
  await userEvent.click(await screen.findByRole('button',{name:'Xóa Học React'}));
  await userEvent.click(screen.getByText('Giữ lại'));
  expect(writes).toBe(0);
  await userEvent.click(screen.getByRole('button',{name:'Mở lại Học React'}));
  expect(await screen.findByText('Khoảng thời gian này đã có kế hoạch')).toBeInTheDocument();
  expect(writes).toBe(1);
  await userEvent.click(screen.getByText('Vẫn tiếp tục'));
  await waitFor(()=>expect(writes).toBe(2));
  expect(JSON.parse(fetcher.mock.calls.find(([,o])=>o.method==='PATCH'&&JSON.parse(o.body).allow_conflict)[1].body).allow_conflict).toBe(true);
});

test('timed form validation preserves input and rejects reversed times',async()=>{
  mount(vi.fn(async()=>ok([])));
  await userEvent.click(screen.getByRole('button',{name:'Thêm công việc'}));
  await userEvent.type(screen.getByLabelText('Tiêu đề'),'Giữ bản nháp');
  await userEvent.click(screen.getByLabelText('Cả ngày'));
  const start=screen.getByLabelText('Bắt đầu'),end=screen.getByLabelText('Kết thúc');
  await userEvent.type(start,'10:00');await userEvent.type(end,'09:00');
  await userEvent.click(screen.getAllByRole('button',{name:'Thêm công việc'})[1]);
  expect(await screen.findByRole('alert')).toHaveTextContent('giờ kết thúc phải sau');
  expect(screen.getByLabelText('Tiêu đề')).toHaveValue('Giữ bản nháp');
});

test('today preset uses Vietnamese business date',async()=>{
  const fetcher=vi.fn(async()=>ok([]));mount(fetcher);
  await userEvent.click(screen.getByText('Hôm nay'));
  await waitFor(()=>expect(fetcher.mock.calls.some(([p])=>p.includes(`task_date=${today()}`)&&p.includes('status=pending'))).toBe(true));
});

test('search debounce queries only latest complete text',async()=>{
  const fetcher=vi.fn(async()=>ok([]));mount(fetcher);
  await userEvent.type(screen.getByRole('textbox',{name:'Tìm công việc'}),'React');
  expect(fetcher.mock.calls.some(([p])=>p.includes('search='))).toBe(false);
  await waitFor(()=>expect(fetcher.mock.calls.some(([p])=>p.includes('search=React'))).toBe(true));
  expect(fetcher.mock.calls.filter(([p])=>p.includes('search='))).toHaveLength(1);
});

test('network failure leaves form draft and never announces success',async()=>{
  const fetcher=vi.fn(async(path,options)=>{
    if(options.method==='POST')throw new TypeError('Offline');
    return ok([]);
  });mount(fetcher);
  await userEvent.click(screen.getByRole('button',{name:'Thêm công việc'}));
  await userEvent.type(screen.getByLabelText('Tiêu đề'),'Giữ draft sau lỗi');
  await userEvent.click(screen.getAllByRole('button',{name:'Thêm công việc',exact:true})[1]);
  expect(await within(screen.getByRole('dialog')).findByRole('alert')).toHaveTextContent('Mất kết nối');
  expect(screen.getByLabelText('Tiêu đề')).toHaveValue('Giữ draft sau lỗi');
  expect(fetcher.mock.calls.filter(([,o])=>o.method==='POST')).toHaveLength(1);
  expect(screen.queryByText('Đã cập nhật kế hoạch của bạn.')).not.toBeInTheDocument();
});
