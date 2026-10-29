import { useEffect,useId,useRef,useState } from 'react';
import { api } from '../api/client';
import ThemeToggle from '../components/ThemeToggle';

export default function AuthScreen({ onLogin }) {
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showPassword,setShowPassword]=useState(false);
  const [invalid,setInvalid]=useState([]);
  const form=useRef(null),errorId=useId();
  useEffect(()=>{if(error&&!busy&&invalid.length)form.current?.elements.namedItem(invalid[0])?.focus();},[error,busy,invalid]);
  const field=name=>({'aria-invalid':invalid.includes(name)?true:undefined,'aria-describedby':invalid.includes(name)?errorId:undefined});

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const values = Object.fromEntries(new FormData(event.currentTarget));
    if (new TextEncoder().encode(values.password).length > 72) {
      setError('Mật khẩu tối đa 72 byte UTF-8.');setInvalid(['password']);form.current.elements.password.focus();return;
    }
    setBusy(true); setError(''); setNotice('');setInvalid([]);
    try {
      const result = await api(`/auth/${register ? 'register' : 'login'}`, { method: 'POST', body: values });
      if (register) { setRegister(false); setNotice('Tạo tài khoản thành công. Bạn có thể đăng nhập.'); }
      else onLogin(result);
    } catch (err) {setError(err.message);const fields=(err.details?.fields||[]).map(f=>f.field.split('.').at(-1));setInvalid(fields);form.current?.elements.namedItem(fields[0]||'email')?.focus();}
    finally { setBusy(false); }
  }

  return <main className="auth-page"><div className="auth-layout">
    <section className="auth-story">
      <a className="brand" href="/">nhịp<span>✳</span></a>
      <div><span className="eyebrow">CÔNG VIỆC · LỊCH · TRỢ LÝ AI</span>
        <h1>Mọi việc,<br />đúng nhịp.</h1>
        <p>Công việc và lịch của bạn, gọn trong một không gian.</p>
        <svg className="rhythm-line" viewBox="0 0 360 80" fill="none" aria-hidden="true"><path d="M1 48C40 48 44 18 76 30S112 77 145 40 180 11 211 44 241 69 270 39 315 56 359 35" stroke="currentColor" strokeWidth="2"/><circle cx="145" cy="40" r="4" fill="currentColor"/></svg>
      </div><small>Không gian cá nhân của bạn.</small>
    </section>
    <section className="auth-panel">
      <div className="auth-tools"><span>nhịp · tài khoản cá nhân</span><ThemeToggle/></div>
      <div className="auth-box"><h2>{register ? 'Tạo tài khoản' : 'Rất vui được gặp lại'}</h2>
        <p>{register ? 'Tạo một không gian riêng cho công việc của bạn.' : 'Đăng nhập để tiếp tục kế hoạch hôm nay.'}</p>
        {error && <div id={errorId} className="alert error" role="alert">{error}</div>}
        {notice && <div className="alert" role="status">{notice}</div>}
        <form ref={form} onSubmit={submit} aria-busy={busy}>
          <fieldset disabled={busy} className="form-fields">
          {register && <label>Họ và tên<input name="name" autoComplete="name" required maxLength={100} {...field('name')}/></label>}
          <label>Email<input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="ban@example.com" {...field('email')}/></label>
          <label>Mật khẩu<input name="password" type={showPassword?'text':'password'} minLength={8} autoComplete={register ? 'new-password' : 'current-password'} required placeholder="Ít nhất 8 ký tự" {...field('password')}/></label>
          <button type="button" className="text-button password-toggle" aria-pressed={showPassword} onClick={()=>setShowPassword(v=>!v)}>{showPassword?'Ẩn mật khẩu':'Hiện mật khẩu'}</button>
          <button className="primary" disabled={busy}>{busy ? 'Đang xử lý…' : register ? 'Tạo tài khoản' : 'Đăng nhập →'}</button>
          </fieldset>
        </form>
        <p className="auth-switch">{register ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'} <button className="text-button" disabled={busy} onClick={() => { setRegister(!register); setError(''); setNotice('');setInvalid([]);setShowPassword(false); }}>{register ? 'Đăng nhập' : 'Đăng ký'}</button></p>
        <small className="muted">Công việc của bạn chỉ hiển thị trong tài khoản của bạn.</small>
      </div>
    </section>
  </div></main>;
}
