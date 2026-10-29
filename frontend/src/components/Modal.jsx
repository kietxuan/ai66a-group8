import { useEffect, useId, useRef } from 'react';
import ThemeToggle from './ThemeToggle';

export default function Modal({title,children,onClose,wide=false,busy=false,description,panel=false}) {
  const ref=useRef(null);
  const id=useId();
  useEffect(() => {
    const dialog=ref.current;
    const previous=document.activeElement;
    dialog.showModal();
    dialog.querySelector('h2')?.focus();
    return () => { dialog.close(); previous?.focus(); };
  },[]);
  return <dialog ref={ref} className={`modal ${wide ? 'wide' : ''}${panel?' editor-panel':''}`} aria-labelledby={id} aria-describedby={description?`${id}-description`:undefined} aria-busy={busy}
    onCancel={e => {e.preventDefault();if(!busy)onClose();}}>
    <div className="modal-heading"><h2 id={id} tabIndex={-1}>{title}</h2><div className="modal-tools"><ThemeToggle/><button type="button" className="icon-button" aria-label="Đóng" disabled={busy} onClick={onClose}>×</button></div></div>
    {description&&<p id={`${id}-description`} className="modal-description">{description}</p>}
    {children}
  </dialog>;
}
