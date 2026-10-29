import { useEffect, useState } from 'react';
import { useTaskData,useTasks,useViewState } from './TaskProvider';
import { addDays,dateLabel,priorityLabels,timeLabel,today } from './dates';
import Icon from '../components/Icon';

const presets=[['all','Tất cả'],['today','Hôm nay'],['tomorrow','Ngày mai'],['upcoming','Sắp tới'],['pending','Chưa xong'],['completed','Đã xong']];
export default function TodoView({onEdit,onDelete,onStatus,busy,businessDate=today()}) {
  const [filters,setFilters]=useViewState('todoFilters',{});
  const [preset,setPreset]=useViewState('todoPreset','all');
  const [search,setSearch]=useViewState('todoSearch','');
  const [debounced,setDebounced]=useState(search.trim());
  const {categories,categoryError,retryCategories,refresh}=useTaskData();
  useEffect(()=>{const id=setTimeout(()=>setDebounced(search.trim()),250);return()=>clearTimeout(id);},[search]);
  const invalidRange=filters.date_from&&filters.date_to&&filters.date_from>filters.date_to;
  const {tasks,loading,error}=useTasks({...filters,search:debounced},!invalidRange);
  const update=e=>{setPreset('custom');setFilters(f=>({...f,[e.target.name]:e.target.value}));};
  function choose(name) {
    setPreset(name);setSearch('');setDebounced('');
    const date=businessDate;
    setFilters(name==='today'?{task_date:date,status:'pending'}:name==='tomorrow'?{task_date:addDays(date,1),status:'pending'}:
      name==='upcoming'?{date_from:addDays(date,1),status:'pending'}:['pending','completed'].includes(name)?{status:name}:{});
  }
  useEffect(()=>{
    if(['today','tomorrow','upcoming'].includes(preset)){
      setFilters(old=>preset==='today'?{...old,task_date:businessDate}:preset==='tomorrow'?{...old,task_date:addDays(businessDate,1)}:{...old,date_from:addDays(businessDate,1)});
    }
  },[businessDate]);
  function rangeChange(e){const {name,value}=e.target;setPreset('custom');setFilters(({task_date,...rest})=>({...rest,...(task_date?{date_from:task_date,date_to:task_date}:{}),[name]:value}));}
  const filtered=!!(search.trim()||Object.values(filters).some(Boolean));
  const completed=tasks.filter(t=>t.status==='completed').length;
  return <section className="todo-view" aria-busy={loading}>
    <div className="preset-tabs" aria-label="Bộ lọc nhanh">{presets.map(([key,label])=><button key={key} aria-pressed={preset===key} className={preset===key?'active':''} onClick={()=>choose(key)}>{label}</button>)}</div>
    <div className="filter-panel">
      <label className="search-field"><Icon name="search"/><input aria-label="Tìm công việc" value={search} maxLength={200} onChange={e=>setSearch(e.target.value)} placeholder="Tìm trong công việc, ghi chú…"/>{search&&<button type="button" className="icon-button" aria-label="Xóa từ khóa tìm kiếm" onClick={()=>{setSearch('');setDebounced('');}}>×</button>}</label>
      <details className="filter-details"><summary>Bộ lọc · {Object.values(filters).filter(Boolean).length} điều kiện</summary>
      <div className="filter-grid">
        <label>Từ ngày<input name="date_from" type="date" max={filters.date_to||undefined} aria-invalid={!!invalidRange} aria-describedby={invalidRange?'date-range-error':undefined} value={filters.date_from||filters.task_date||''} onChange={rangeChange}/></label>
        <label>Đến ngày<input name="date_to" type="date" min={filters.date_from||undefined} aria-invalid={!!invalidRange} aria-describedby={invalidRange?'date-range-error':undefined} value={filters.date_to||filters.task_date||''} onChange={rangeChange}/></label>
        <label>Trạng thái<select name="status" value={filters.status||''} onChange={update}><option value="">Tất cả</option><option value="pending">Chưa xong</option><option value="completed">Đã xong</option></select></label>
        <label>Ưu tiên<select name="priority" value={filters.priority||''} onChange={update}><option value="">Mọi mức</option>{Object.entries(priorityLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
        <label>Danh mục<select name="category_id" value={filters.category_id||''} onChange={update}><option value="">Mọi danh mục</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <button className="reset-filters" onClick={()=>choose('all')}>Đặt lại</button>
      </div>
      </details>
      {invalidRange&&<p id="date-range-error" className="alert error" role="alert">Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.</p>}
      {['today','tomorrow','upcoming'].includes(preset)&&<p className="filter-hint">Đang hiển thị công việc chưa hoàn thành trong khoảng ngày đã chọn.</p>}
      {categoryError&&<p className="alert error" role="alert">Chưa tải được danh mục. <button onClick={retryCategories}>Tải lại danh mục</button></p>}
    </div>
    <div className="list-heading"><h2>Công việc của bạn <span>{loading?'…':tasks.length}</span></h2><span role={loading?'status':undefined}>{loading?'Đang cập nhật…':`${completed} đã hoàn thành trong danh sách này`}</span></div>
    {error&&<div className="alert error" role="alert">{error} <button onClick={refresh}>Tải lại</button></div>}
    {loading&&!tasks.length?<div className="empty-state" role="status"><span className="empty-symbol">◌</span><p>Đang tải công việc…</p></div>:
      !tasks.length&&!error?<div className="empty-state"><span className="empty-symbol"><Icon name="list" size={28}/></span><h3>{filtered?'Không có kết quả phù hợp':'Chưa có công việc'}</h3><p>{filtered?'Thử thay đổi hoặc đặt lại bộ lọc.':'Chọn “Thêm công việc” để bắt đầu.'}</p>{filtered&&<button onClick={()=>choose('all')}>Xóa bộ lọc</button>}</div>:
      <div className="task-list">{tasks.map(task=><article key={task.id} className={`task-item ${task.status==='completed'?'is-completed':''}`}>
        <button className="task-check" disabled={busy} aria-label={`${task.status==='completed'?'Mở lại':'Hoàn thành'} ${task.title}`} onClick={()=>onStatus(task)}>{task.status==='completed'?'✓':''}</button>
        <button className="task-body" disabled={busy} onClick={()=>onEdit(task)}><strong>{task.title}</strong>{task.description&&<p>{task.description}</p>}
          <div className="task-meta"><span><Icon name="calendar" size={14}/> {dateLabel(task.task_date)}</span><span><Icon name="clock" size={14}/> {timeLabel(task)}</span><span className="category-tag">{task.category_id?(categories.find(c=>c.id===task.category_id)?.name||'Chưa tải được danh mục'):'Không phân loại'}</span>{task.status==='pending'&&task.task_date<businessDate&&<span className="overdue">Chưa xong · đã qua ngày</span>}</div></button>
        <span className={`priority-tag ${task.priority}`}><i/> {priorityLabels[task.priority]}</span>
        <button className="icon-button delete-task" aria-label={`Xóa ${task.title}`} disabled={busy} onClick={()=>onDelete(task)}><Icon name="trash" size={18}/></button>
      </article>)}</div>}
  </section>;
}
