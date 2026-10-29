export class ApiError extends Error {
  constructor(status, error) {
    super(error?.message || 'Không thể hoàn tất yêu cầu');
    this.status = status;
    this.code = error?.code;
    this.details = error?.details || {};
  }
}

let sessionEpoch = 0;
export function changeSession() { sessionEpoch += 1; }

export async function api(path, { method = 'GET', body, signal, timeoutMs = path.startsWith('/chat') ? 45000 : 20000 } = {}) {
  const epoch = sessionEpoch;
  const controller = new AbortController();
  let timer, abortListener;
  const stopped = new Promise((_, reject) => {
    abortListener = () => { controller.abort(); reject(new DOMException('Aborted', 'AbortError')); };
    signal?.addEventListener('abort', abortListener, {once:true});
    if (signal?.aborted) abortListener();
    timer = setTimeout(() => {
      controller.abort();
      reject(new ApiError(0,{code:'REQUEST_TIMEOUT',message:method==='GET'
        ? 'Máy chủ phản hồi quá lâu. Bạn có thể tải lại dữ liệu.'
        : 'Yêu cầu chờ quá lâu; chưa xác định kết quả. Hãy kiểm tra Todo hoặc yêu cầu đang chờ trước khi gửi lại.'}));
    },timeoutMs);
  });
  const perform=async()=>{
    const response=await fetch(`/api${path}`,{
      method,credentials:'include',signal:controller.signal,
      headers:{...(method!=='GET'?{'X-Requested-With':'todo-app'}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{})},
      ...(body!==undefined?{body:JSON.stringify(body)}:{}),
    });
    if(response.status===204)return null;
    let payload;
    try{payload=await response.json();}
    catch{throw new ApiError(response.status,{code:'INVALID_RESPONSE',message:'Phản hồi máy chủ không hợp lệ. Hãy kiểm tra dữ liệu trước khi thử lại.'});}
    if(!response.ok){
      if(response.status===401&&epoch===sessionEpoch&&!path.startsWith('/auth/'))window.dispatchEvent(new Event('session-expired'));
      throw new ApiError(response.status,payload.error);
    }
    if(!payload||!Object.hasOwn(payload,'data'))throw new ApiError(response.status,{code:'INVALID_RESPONSE'});
    return payload.data;
  };
  try{return await Promise.race([stopped,perform()]);}
  catch(error){
    if(error instanceof ApiError||error.name==='AbortError')throw error;
    throw new ApiError(0,{code:'NETWORK_ERROR',message:'Mất kết nối. Hãy kiểm tra lại danh sách công việc trước khi gửi lại yêu cầu.'});
  }finally{clearTimeout(timer);signal?.removeEventListener('abort',abortListener);}
}
