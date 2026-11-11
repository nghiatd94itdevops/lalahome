import { money } from "../../api.js";
import { useApi } from "../client.js";
import { LoadState, Metric, Panel, useAdmin } from "../ui.jsx";

const count = (value) => Number(value || 0).toLocaleString("vi-VN");

export default function Reports() {
  const { exportExcel } = useAdmin();
  const reports = useApi("/reports");
  const r = reports.data;

  const exportReport = () => exportExcel("bao-cao-quan-tri.xlsx", [
    {
      name: "Tổng quan",
      columns: [{ header: "Chỉ số", key: "label", width: 28 }, { header: "Giá trị", key: "value", width: 20, number: true }],
      rows: [
        ["Tổng tồn kho", r.totalStock], ["Giá trị kho", r.inventoryValue], ["Số lượng đã bán", r.soldQuantity], ["Số đơn hàng", r.orderCount],
        ["Doanh thu gốc", r.grossRevenue], ["Chiết khấu", r.discountAmount], ["Doanh thu sau giảm", r.revenue], ["Đã thu", r.collected],
        ["Công nợ", r.debt], ["Giá vốn ước tính", r.estimatedCost], ["Lợi nhuận gộp ước tính", r.estimatedProfit],
      ].map(([label, value]) => ({ label, value })),
    },
    {
      name: "Theo nhân viên",
      rows: r.salesByEmployee,
      columns: [
        { header: "Nhân viên", key: "employee", width: 24 }, { header: "Số đơn", key: "order_count", width: 10, number: true },
        { header: "Doanh thu", key: "revenue", width: 18, number: true }, { header: "Đã thu", key: "collected", width: 18, number: true }, { header: "Công nợ", key: "debt", width: 18, number: true },
      ],
    },
    {
      name: "Theo sản phẩm",
      rows: r.salesByProduct,
      columns: [
        { header: "Mã sản phẩm", key: "product_id", width: 12 }, { header: "Sản phẩm", key: "product_name", width: 30 },
        { header: "Số lượng bán", key: "quantity", width: 14, number: true }, { header: "Doanh thu", key: "revenue", width: 18, number: true },
      ],
    },
  ]);

  return (
    <LoadState resource={reports}>
      {r && (
        <div className="stack">
          <div className="report-toolbar">
            <div><p className="eyebrow">DỮ LIỆU QUẢN TRỊ</p><p className="field-hint">Xuất tổng quan, doanh số nhân viên và sản phẩm trong cùng một workbook. Chỉ tính đơn đang hoạt động.</p></div>
            <button type="button" className="btn btn-door" onClick={exportReport}>Xuất báo cáo Excel</button>
          </div>
          <dl className="summary-lines">
            <div><dt>Doanh thu gốc</dt><dd>{money(r.grossRevenue)}</dd></div>
            <div><dt>Tổng chiết khấu</dt><dd>- {money(r.discountAmount)}</dd></div>
            <div><dt>Doanh thu sau giảm</dt><dd>{money(r.revenue)}</dd></div>
            <div><dt>Lợi nhuận gộp ước tính</dt><dd>{money(r.estimatedProfit)}</dd></div>
          </dl>
          <div className="metric-grid">
            <Metric label="DOANH THU" value={money(r.revenue)} note={`${count(r.orderCount)} đơn hàng`} />
            <Metric label="ĐÃ THU" value={money(r.collected)} />
            <Metric label="CÔNG NỢ" value={money(r.debt)} tone="warn" />
            <Metric label="SẢN PHẨM ĐÃ BÁN" value={count(r.soldQuantity)} />
            <Metric label="TỒN KHO" value={count(r.totalStock)} note={`Giá trị ${money(r.inventoryValue)}`} />
          </div>
          <Panel title="Doanh số theo nhân viên">
            <div className="table-wrap">
              <table className="ledger-table">
                <thead><tr><th>Nhân viên</th><th className="num">Số đơn</th><th className="num">Doanh số</th><th className="num">Đã thu</th><th className="num">Công nợ</th></tr></thead>
                <tbody>{r.salesByEmployee.map((row) => <tr key={row.employee}><td>{row.employee}</td><td className="num">{row.order_count}</td><td className="num">{money(row.revenue)}</td><td className="num">{money(row.collected)}</td><td className="num">{money(row.debt)}</td></tr>)}</tbody>
              </table>
            </div>
          </Panel>
          <Panel title="Sản lượng bán theo sản phẩm">
            <div className="table-wrap">
              <table className="ledger-table">
                <thead><tr><th>Sản phẩm</th><th className="num">Số lượng bán</th><th className="num">Doanh thu</th></tr></thead>
                <tbody>{r.salesByProduct.map((row) => <tr key={row.product_id}><td>{row.product_name}</td><td className="num">{count(row.quantity)}</td><td className="num">{money(row.revenue)}</td></tr>)}</tbody>
              </table>
            </div>
          </Panel>
          <Panel title="Tồn kho hiện tại">
            <div className="table-wrap">
              <table className="ledger-table">
                <thead><tr><th>Sản phẩm</th><th>Loại</th><th className="num">Tồn</th><th className="num">Giá trị tồn</th></tr></thead>
                <tbody>
                  {r.products.filter((p) => p.active).map((p) => (
                    <tr key={p.id} className={Number(p.stock) <= Number(p.min_stock) ? "is-low" : ""}>
                      <td>{p.name}</td><td>{p.category}</td><td className="num">{count(p.stock)} {p.unit}</td><td className="num">{money(Number(p.stock) * Number(p.cost_price || p.price))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}
    </LoadState>
  );
}
