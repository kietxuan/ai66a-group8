import { act,render,screen,waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { api } from '../api/client';
import { TaskProvider,useTasks,useTaskData } from '../tasks/TaskProvider';

const ok=data=>({ok:true,status:200,json:async()=>({data})});
function deferred(){let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};}
function List({filters}) {
  const {tasks,loading,error}=useTasks(filters);
  const {refresh,retryCategories,categoryError}=useTaskData();
  return <><button onClick={refresh}>Refresh</button><button onClick={retryCategories}>Retry categories</button><p>{categoryError}</p><p>{error}</p>
    {loading?<p>Loading</p>:tasks.map(t=><p key={t.id}>{t.title}</p>)}</>;
}

test('late list response cannot replace a newer filter result',async()=>{
  const old=deferred(),fresh=deferred();
  vi.stubGlobal('fetch',vi.fn(path=>path==='/api/categories'?Promise.resolve(ok([])):path.includes('search=old')?old.promise:fresh.promise));
  const view=render(<TaskProvider><List filters={{search:'old'}}/></TaskProvider>);
  view.rerender(<TaskProvider><List filters={{search:'fresh'}}/></TaskProvider>);
  await act(async()=>fresh.resolve(ok([{id:2,title:'Fresh result'}])));
  expect(await screen.findByText('Fresh result')).toBeInTheDocument();
  await act(async()=>old.resolve(ok([{id:1,title:'Old result'}])));
  expect(screen.queryByText('Old result')).not.toBeInTheDocument();
});

test('category retry clears old failure and list errors remain actionable',async()=>{
  let attempts=0;
  vi.stubGlobal('fetch',vi.fn(async path=>{
    if(path==='/api/categories'&&attempts++===0)throw new Error('Offline');
    return ok([]);
  }));
  render(<TaskProvider><List filters={{}}/></TaskProvider>);
  expect(await screen.findByText(/Mất kết nối/)).toBeInTheDocument();
  await userEvent.click(screen.getByText('Retry categories'));
  await waitFor(()=>expect(screen.queryByText(/Mất kết nối/)).not.toBeInTheDocument());
});

test('protected 401 clears auth, task and chat state',async()=>{
  vi.stubGlobal('fetch',vi.fn(async path=>path==='/api/auth/me'?ok({id:1,name:'Owner A'}):path==='/api/categories'?ok([]):
    {ok:false,status:401,json:async()=>({error:{code:'UNAUTHENTICATED',message:'Expired'}})}));
  render(<App/>);
  expect(await screen.findByRole('heading',{name:'Rất vui được gặp lại'})).toBeInTheDocument();
  expect(screen.queryByText('Owner A')).not.toBeInTheDocument();
  expect(screen.queryByRole('button',{name:'Lịch của tôi'})).not.toBeInTheDocument();
});

test('network write failure is not retried and tells user to inspect tasks',async()=>{
  const fetcher=vi.fn().mockRejectedValue(new TypeError('Network error'));
  vi.stubGlobal('fetch',fetcher);
  await expect(api('/tasks',{method:'POST',body:{title:'One attempt'}})).rejects.toThrow('kiểm tra lại danh sách');
  expect(fetcher).toHaveBeenCalledTimes(1);
});

test('backend validation error preserves typed error code without logout',async()=>{
  const expired=vi.fn();window.addEventListener('session-expired',expired);
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,status:422,json:async()=>({error:{code:'VALIDATION_ERROR',message:'Invalid time'}})}));
  try {
    await expect(api('/tasks',{method:'POST',body:{}})).rejects.toMatchObject({status:422,code:'VALIDATION_ERROR'});
    expect(expired).not.toHaveBeenCalled();
  } finally {window.removeEventListener('session-expired',expired);}
});
