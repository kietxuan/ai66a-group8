import { useEffect, useState } from 'react';
import { api,changeSession } from './api/client';
import AuthScreen from './auth/AuthScreen';
import { TaskProvider } from './tasks/TaskProvider';
import Workspace from './tasks/Workspace';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [logoutError,setLogoutError]=useState('');
  const [loggingOut,setLoggingOut]=useState(false);
  useEffect(() => {
    let active = true;
    api('/auth/me').then(data => { if (active) setUser(data); }).catch(err => {
      if (active && err.status !== 401) setError(err.message);
    }).finally(() => { if (active) setLoading(false); });
    const expired = () => {changeSession();setUser(null);setLogoutError('');};
    window.addEventListener('session-expired', expired);
    return () => { active = false; window.removeEventListener('session-expired', expired); };
  }, []);
  async function logout() {
    if(loggingOut)return;
    setLoggingOut(true);setLogoutError('');
    try { await api('/auth/logout', { method: 'POST' }); }
    catch(err) { if(err.status!==401){setLogoutError(err.message);return;} }
    finally{setLoggingOut(false);}
    changeSession();
    setUser(null);
  }
  if (loading) return <main className="loading-screen" role="status">Đang mở không gian của bạn…</main>;
  if (error) return <main className="loading-screen"><p role="alert">{error}</p><button onClick={() => location.reload()}>Thử kết nối lại</button></main>;
  if (!user) return <AuthScreen onLogin={data=>{changeSession();setLogoutError('');setUser(data);}} />;
  return <TaskProvider key={user.id}><Workspace user={user} onLogout={logout} logoutError={logoutError} loggingOut={loggingOut}/></TaskProvider>;
}
