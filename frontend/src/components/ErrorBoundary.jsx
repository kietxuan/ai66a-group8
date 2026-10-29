import { Component } from 'react';

export default class ErrorBoundary extends Component {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){
    if(this.state.failed)return <section className="empty-state" role="alert"><h2>Chưa mở được nội dung này</h2><p>Dữ liệu đã lưu vẫn ở máy chủ. Bạn có thể tải lại trang để thử lại.</p><button onClick={()=>location.reload()}>Tải lại trang</button></section>;
    return this.props.children;
  }
}
