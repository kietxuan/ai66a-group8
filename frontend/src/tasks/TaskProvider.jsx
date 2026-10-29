import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/client';

const Tasks = createContext(null);
export function TaskProvider({ children }) {
  const [categories, setCategories] = useState([]);
  const [categoryError, setCategoryError] = useState('');
  const [revision, setRevision] = useState(0);
  const [categoryRevision,setCategoryRevision]=useState(0);
  const [viewState,setViewState]=useState({});
  const refresh = useCallback(() => setRevision(x => x + 1), []);
  const retryCategories=useCallback(()=>setCategoryRevision(x=>x+1),[]);
  useEffect(()=>{
    let last=0;
    const resume=()=>{if(document.visibilityState==='visible'&&Date.now()-last>15000){last=Date.now();refresh();}};
    document.addEventListener('visibilitychange',resume);window.addEventListener('focus',resume);
    return()=>{document.removeEventListener('visibilitychange',resume);window.removeEventListener('focus',resume);};
  },[refresh]);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    api('/categories', {signal:controller.signal}).then(data => {
      if (active) { setCategories(data); setCategoryError(''); }
    }).catch(err => {
      if (active && err.name !== 'AbortError') setCategoryError(err.message);
    });
    return () => { active = false; controller.abort(); };
  }, [categoryRevision]);
  const mutate = useCallback(async (operation, taskId, body, allowConflict = false) => {
    let path = operation === 'create' ? '/tasks' : `/tasks/${taskId}${operation === 'status' ? '/status' : ''}`;
    if(operation==='delete'&&body?.expected_version)path+=`?expected_version=${encodeURIComponent(body.expected_version)}`;
    const method = {create:'POST',update:'PUT',status:'PATCH',delete:'DELETE'}[operation];
    const result = await api(path, {method, ...(body && operation!=='delete' ? {body:{...body,allow_conflict:allowConflict}} : {})});
    refresh();
    return result;
  }, [refresh]);
  const value = useMemo(() => ({categories,categoryError,revision,refresh,mutate,retryCategories,viewState,setViewState}), [categories,categoryError,revision,refresh,mutate,retryCategories,viewState]);
  return <Tasks.Provider value={value}>{children}</Tasks.Provider>;
}
export const useTaskData = () => useContext(Tasks);

export function useViewState(key, initial) {
  const initialRef=useRef(initial);
  const {viewState,setViewState}=useTaskData();
  const value=Object.hasOwn(viewState,key)?viewState[key]:initial;
  const set=useCallback(next=>setViewState(old=>({...old,[key]:typeof next==='function'?next(Object.hasOwn(old,key)?old[key]:initialRef.current):next})),[key,setViewState]);
  return [value,set];
}

export function useTasks(filters, enabled=true) {
  const {revision} = useTaskData();
  const [state, setState] = useState({tasks:[],loading:true,error:''});
  const query = new URLSearchParams(Object.entries(filters).filter(([,v]) => v !== '' && v != null)).toString();
  useEffect(() => {
    if(!enabled){setState({tasks:[],loading:false,error:'',query});return;}
    const controller = new AbortController();
    let active = true;
    setState(old=>({tasks:old.query===query?old.tasks:[],loading:true,error:'',query}));
    api(`/tasks${query ? '?' + query : ''}`, {signal:controller.signal}).then(tasks => {
      if (active) setState({tasks,loading:false,error:'',query});
    }).catch(err => {
      if (active && err.name !== 'AbortError') setState(old=>({...old,loading:false,error:err.message}));
    });
    return () => { active = false; controller.abort(); };
  }, [query,revision,enabled]);
  return state;
}
