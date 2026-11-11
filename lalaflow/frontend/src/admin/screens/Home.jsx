import { Link } from "react-router-dom";
import { money } from "../../api.js";
import { useApi } from "../client.js";
import { LoadState, Metric, Panel, useAdmin } from "../ui.jsx";

export default function Home() {
  const { user, can, goTo } = useAdmin();
  const canReport = can("reports.view");
  const dashboard = useApi(canReport ? "/dashboard" : null);
  const data = dashboard.data;

  return (
    <>
      <section className="workspace-hero">
        <div>
          <p className="eyebrow">LALAFLOW WORKSPACE</p>
          <h2>Chào {user.name}</h2>
          <p className="lead">Quản lý nội dung website, sản phẩm, kho, đơn hàng và khách hàng LalaFlow tại một nơi.</p>
          <div className="actions">
            <Link to="/" className="btn btn-paper">Xem website</Link>
            {canReport && <button type="button" className="btn btn-door" onClick={() => goTo("dashboard")}>Mở Dashboard</button>}
          </div>
        </div>
      </section>

      {canReport ? (
        <LoadState resource={dashboard}>
          {data && (
            <>
              <div className="section-row">
                <div>
                  <p className="eyebrow">TỔNG QUAN KINH DOANH</p>
                  <h2 className="row-title">Tình hình hoạt động</h2>
                </div>
                <button type="button" className="btn btn-paper btn-small" onClick={() => goTo("reports")}>Xem báo cáo chi tiết →</button>
              </div>
              <div className="metric-grid">
                <Metric label="DOANH THU" value={money(data.revenue)} note="Tổng doanh thu đơn active" />
                <Metric label="ĐƠN HÀNG" value={data.orderCount} note="Đơn đang hoạt động" />
                <Metric label="CÔNG NỢ" value={money(data.debt)} note="Số tiền cần thu" tone="warn" />
                <Metric label="SẮP HẾT KHO" value={data.lowStock} note="Tồn bằng hoặc dưới ngưỡng tối thiểu" />
                <Metric label="YÊU CẦU MỚI" value={data.newQuoteRequests} note="Yêu cầu từ website" />
              </div>
              {data.recentRequests && (
              <Panel title="Việc cần quan tâm" subtitle="Yêu cầu tư vấn mới nhất từ khách hàng.">
                {data.recentRequests?.length ? (
                  <ul className="row-list">
                    {data.recentRequests.map((row) => (
                      <li key={row.id}>
                        <span><strong>{row.customer_name}</strong>{row.phone} · {row.product_name || "Chưa chọn sản phẩm"} · {row.status}</span>
                        <button type="button" className="btn btn-paper btn-small" onClick={() => goTo("quote_requests")}>Xử lý</button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="load-note">Không có yêu cầu mới. Mọi yêu cầu khách hàng đã được ghi nhận.</p>
                )}
              </Panel>
              )}
            </>
          )}
        </LoadState>
      ) : (
        <div className="metric-grid">
          <Metric label="TÀI KHOẢN" value={user.name} note={user.email} />
          <Metric label="NHÓM LÀM VIỆC" value={user.groupName || "Nhân viên"} />
          <Metric label="TRẠNG THÁI" value="Đang hoạt động" note="Phiên đăng nhập an toàn" />
        </div>
      )}
    </>
  );
}
