import { Link } from "react-router-dom";

export default function Later({ title, text }) {
  return (
    <div className="panel later">
      <span className="later-sign" aria-hidden="true">Đang phát triển</span>
      <h2>{title}</h2>
      <p>{text || "Màn hình này sẽ được làm ở đợt 3 theo giao diện mới. Backend và dữ liệu vẫn giữ nguyên."}</p>
      <Link to="/admin/home" className="btn btn-paper">← Về LalaFlow Home</Link>
    </div>
  );
}
