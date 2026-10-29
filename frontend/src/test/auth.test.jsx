import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';

const response = (data, status = 200) => ({ok: status < 400, status, json: async () => status < 400 ? {data} : {error: {message: 'Vui lòng đăng nhập', code: 'UNAUTHENTICATED'}}});

test('startup restores session and logout clears protected state', async () => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async path => path==='/api/auth/me'?response({id:1,name:'An',email:'an@example.com'}):path==='/api/auth/logout'?response(null,204):response([])));
  render(<App />);
  expect(screen.getByRole('status')).toBeInTheDocument();
  expect(await screen.findByText('An')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button',{name:'Đăng xuất'}));
  expect(await screen.findByRole('heading', {name: 'Rất vui được gặp lại'})).toBeInTheDocument();
});

test('register returns to login and sends cookie-safe write headers', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(response(null,401)).mockResolvedValueOnce(response({id:1},201));
  vi.stubGlobal('fetch', fetcher);
  render(<App />);
  await userEvent.click(await screen.findByText('Đăng ký'));
  await userEvent.type(screen.getByLabelText('Họ và tên'),'An');
  await userEvent.type(screen.getByLabelText('Email'),'an@example.com');
  await userEvent.type(screen.getByLabelText('Mật khẩu'),'test-pass-123');
  await userEvent.click(screen.getByRole('button',{name:'Tạo tài khoản'}));
  expect(await screen.findByRole('status')).toHaveTextContent('Tạo tài khoản thành công');
  expect(fetcher.mock.calls[1][1]).toMatchObject({credentials:'include',headers:{'X-Requested-With':'todo-app','Content-Type':'application/json'}});
});
