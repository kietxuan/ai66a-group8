import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach } from 'vitest';
import ThemeToggle, { THEME_KEY } from '../components/ThemeToggle';
import AuthScreen from '../auth/AuthScreen';
import { TaskProvider } from '../tasks/TaskProvider';
import Workspace from '../tasks/Workspace';

const ok = data => ({ok:true,status:200,json:async()=>({data})});
function media(dark = false) {
  const listeners = new Set();
  const query = {matches:dark,addEventListener:(_,fn)=>listeners.add(fn),removeEventListener:(_,fn)=>listeners.delete(fn)};
  vi.stubGlobal('matchMedia',vi.fn(()=>query));
  return value => act(()=>{query.matches=value;listeners.forEach(fn=>fn({matches:value}));});
}
afterEach(()=>{
  cleanup();localStorage.removeItem(THEME_KEY);
  delete document.documentElement.dataset.theme;
  delete document.documentElement.dataset.themeChoice;
});

test('first visit follows the system until explicitly selected, then persists across remount',async()=>{
  const changeSystem = media(true);
  const view = render(<ThemeToggle/>);
  expect(screen.getByRole('button',{name:'Chế độ tối'})).toHaveAttribute('aria-pressed','true');
  expect(document.documentElement.dataset.theme).toBe('dark');
  changeSystem(false);
  expect(document.documentElement.dataset.theme).toBe('light');
  await userEvent.click(screen.getByRole('button',{name:'Chế độ tối'}));
  expect(localStorage.getItem(THEME_KEY)).toBe('dark');
  changeSystem(false);
  expect(document.documentElement.dataset.theme).toBe('dark');
  view.unmount();render(<ThemeToggle/>);
  expect(screen.getByRole('button',{name:'Chế độ tối'})).toHaveAttribute('aria-pressed','true');
});

test('invalid stored choice falls back to system and unrelated storage events do not change theme',()=>{
  localStorage.setItem(THEME_KEY,'invalid');media(false);render(<ThemeToggle/>);
  expect(document.documentElement.dataset.theme).toBe('light');
  fireEvent(window,new StorageEvent('storage',{key:'unrelated',newValue:'dark'}));
  expect(document.documentElement.dataset.theme).toBe('light');
  fireEvent(window,new StorageEvent('storage',{key:THEME_KEY,newValue:'dark'}));
  expect(document.documentElement.dataset.theme).toBe('dark');
  fireEvent(window,new StorageEvent('storage',{key:THEME_KEY,newValue:null}));
  expect(document.documentElement.dataset.theme).toBe('light');
});

test('blocked storage still allows toggling and retains choice when a modal mounts',async()=>{
  media(false);
  vi.spyOn(Storage.prototype,'getItem').mockImplementation(()=>{throw new Error('blocked');});
  vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('blocked');});
  const first = render(<ThemeToggle/>);
  await userEvent.click(screen.getByRole('button',{name:'Chế độ tối'}));
  first.unmount();render(<ThemeToggle/>);
  expect(screen.getByRole('button',{name:'Chế độ tối'})).toHaveAttribute('aria-pressed','true');
  await userEvent.click(screen.getByRole('button',{name:'Chế độ tối'}));
  expect(document.documentElement.dataset.theme).toBe('light');
});

test('theme does not reset auth input or make any network request',async()=>{
  media(false);const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
  render(<AuthScreen onLogin={vi.fn()}/>);
  await userEvent.type(screen.getByLabelText('Email'),'qa@example.com');
  await userEvent.type(screen.getByLabelText('Mật khẩu'),'synthetic-pass');
  await userEvent.click(screen.getByRole('button',{name:'Chế độ tối'}));
  expect(screen.getByLabelText('Email')).toHaveValue('qa@example.com');
  expect(screen.getByLabelText('Mật khẩu')).toHaveValue('synthetic-pass');
  expect(fetcher).not.toHaveBeenCalled();
  expect(localStorage.length).toBe(1);
});

test('editor theme sync retains dirty draft, cancel protection and existing task service',async()=>{
  media(false);const fetcher=vi.fn(async path=>path==='/api/chat/context'?ok({flow:null}):ok([]));
  vi.stubGlobal('fetch',fetcher);
  render(<TaskProvider><Workspace user={{id:1,name:'QA'}} onLogout={vi.fn()}/></TaskProvider>);
  await userEvent.click(screen.getByRole('button',{name:'Thêm công việc'}));
  const dialog=screen.getByRole('dialog');
  expect(dialog).toHaveClass('editor-panel');
  await userEvent.type(within(dialog).getByLabelText('Tiêu đề'),'Bản nháp cần giữ');
  await userEvent.click(within(dialog).getByLabelText('Cả ngày'));
  await userEvent.type(within(dialog).getByLabelText('Bắt đầu'),'08:00');
  await userEvent.type(within(dialog).getByLabelText('Kết thúc'),'12:00');
  await userEvent.click(within(dialog).getByRole('button',{name:'Chế độ tối'}));
  expect(within(dialog).getByLabelText('Tiêu đề')).toHaveValue('Bản nháp cần giữ');
  expect(within(dialog).getByLabelText('Bắt đầu')).toHaveValue('08:00');
  expect(within(dialog).getByLabelText('Kết thúc')).toHaveValue('12:00');
  expect(screen.getAllByRole('button',{name:'Chế độ tối'}).every(button=>button.getAttribute('aria-pressed')==='true')).toBe(true);
  await userEvent.click(within(dialog).getByRole('button',{name:'Hủy',exact:true}));
  expect(screen.getByRole('dialog',{name:'Bỏ thay đổi chưa lưu?'})).toBeInTheDocument();
  expect(fetcher.mock.calls.some(([,options])=>options.method==='POST')).toBe(false);
});

test('chat draft, filters and current page survive theme switching without new requests',async()=>{
  media(false);const fetcher=vi.fn(async path=>path==='/api/chat/context'?ok({flow:null}):ok([]));
  vi.stubGlobal('fetch',fetcher);
  render(<TaskProvider><Workspace user={{id:1,name:'QA'}} onLogout={vi.fn()}/></TaskProvider>);
  await userEvent.type(screen.getByLabelText('Tìm công việc'),'React');
  await waitFor(()=>expect(fetcher.mock.calls.some(([path])=>path.includes('search=React'))).toBe(true));
  await userEvent.click(screen.getByRole('button',{name:'Trợ lý AI',exact:true}));
  await waitFor(()=>expect(screen.getByLabelText('Nội dung yêu cầu')).toBeEnabled());
  await userEvent.type(screen.getByLabelText('Nội dung yêu cầu'),'Ngày mai học bài');
  const calls=fetcher.mock.calls.length;
  await userEvent.click(screen.getByRole('button',{name:'Chế độ tối'}));
  expect(screen.getByLabelText('Nội dung yêu cầu')).toHaveValue('Ngày mai học bài');
  expect(location.pathname).toBe('/chat');
  expect(fetcher).toHaveBeenCalledTimes(calls);
  await userEvent.click(screen.getByRole('button',{name:'Công việc',exact:true}));
  expect(screen.getByLabelText('Tìm công việc')).toHaveValue('React');
});

test('short visual viewport activates compact chat and preserves draft through resize',async()=>{
  media(false);const viewport=new EventTarget();viewport.height=500;
  vi.stubGlobal('visualViewport',viewport);
  vi.stubGlobal('fetch',vi.fn(async path=>path==='/api/chat/context'?ok({flow:null}):ok([])));
  const view=render(<TaskProvider><Workspace user={{id:1,name:'QA'}} onLogout={vi.fn()}/></TaskProvider>);
  await userEvent.click(screen.getByRole('button',{name:'Trợ lý AI',exact:true}));
  await waitFor(()=>expect(screen.getByLabelText('Nội dung yêu cầu')).toBeEnabled());
  await userEvent.type(screen.getByLabelText('Nội dung yêu cầu'),'Giữ nội dung khi mở bàn phím');
  expect(view.container.querySelector('.chat-layout')).toHaveClass('is-compact');
  act(()=>{viewport.height=844;viewport.dispatchEvent(new Event('resize'));});
  expect(view.container.querySelector('.chat-layout')).not.toHaveClass('is-compact');
  expect(screen.getByLabelText('Nội dung yêu cầu')).toHaveValue('Giữ nội dung khi mở bàn phím');
});
