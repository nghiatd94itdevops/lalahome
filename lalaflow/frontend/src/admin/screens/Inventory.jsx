import { useState } from "react";
import { money } from "../../api.js";
import { request, useApi } from "../client.js";
import { excelDate } from "../excel.js";
import { Badge, Field, LoadState, Metric, Pagination, Panel, SearchBox, includesText, useAdmin, usePaged } from "../ui.jsx";

const EMPTY_MOVE = { type: "import", productId: "", quantity: "1", note: "" };
const dayOf = (value) => (value ? new Date(value).toLocaleDateString("sv-SE") : "");

export function InventoryTransaction() {
  const { run, notify } = useAdmin();
  const products = useApi("/products?all=1");
  const [form, setForm] = useState(EMPTY_MOVE);
  const [busy, setBusy] = useState(false);
  const active = (products.data || []).filter((p) => p.active);
  const chosen = active.find((p) => String(p.id) === form.productId);
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  async function submit(event) {
    event.preventDefault();
    const quantity = Number(form.quantity);
    if (!chosen) return notify("error", "Vui lòng chọn sản phẩm cần nhập hoặc xuất kho.");
    if (!Number.isInteger(quantity) || quantity < 1) return notify("error", "Số lượng nhập/xuất phải là số nguyên lớn hơn 0.");
    if (form.type === "export" && quantity > Number(chosen.stock)) return notify("error", `Không đủ tồn kho. ${chosen.name} hiện chỉ còn ${chosen.stock} ${chosen.unit}.`);
    setBusy(true);
    const ok = await run(
      () => request("/inventory", { method: "POST", body: { type: form.type, productId: chosen.id, quantity, note: form.note.trim() } }),
      form.type === "import" ? "Đã ghi nhận nhập kho" : "Đã ghi nhận xuất kho",
    );
    setBusy(false);
    if (ok) {
      setForm({ ...EMPTY_MOVE, type: form.type });
      products.reload();
    }
  }

  return (
    <Panel title="Ghi nhận nhập / xuất kho" subtitle="Tồn kho sản phẩm được cập nhật ngay sau khi lưu.">
      <LoadState resource={products}>
        <form onSubmit={submit} className="stack">
          <div className="segmented" role="group" aria-label="Loại giao dịch">
            {[["import", "Nhập kho"], ["export", "Xuất kho"]].map(([value, label]) => (
              <button key={value} type="button" className={form.type === value ? "is-active" : ""} aria-pressed={form.type === value} onClick={() => setForm({ ...form, type: value })}>{label}</button>
            ))}
          </div>
          <div className="form-grid">
            <Field label="Sản phẩm *">
              <select id="move-product" value={form.productId} onChange={set("productId")} required>
                <option value="">Chọn sản phẩm</option>
                {active.map((p) => <option key={p.id} value={p.id}>{p.name} — tồn {p.stock} {p.unit}</option>)}
              </select>
            </Field>
            <Field label="Số lượng *" hint={chosen ? `Tồn sau giao dịch: ${Number(chosen.stock) + (form.type === "import" ? 1 : -1) * (Number(form.quantity) || 0)} ${chosen.unit}` : undefined}>
              <input id="move-quantity" type="number" min="1" step="1" value={form.quantity} onChange={set("quantity")} required />
            </Field>
            <Field label="Ghi chú / chứng từ" wide><input id="move-note" value={form.note} onChange={set("note")} /></Field>
          </div>
          <div className="form-actions"><button type="submit" className="btn btn-door" disabled={busy}>Ghi nhận giao dịch</button></div>
        </form>
      </LoadState>
    </Panel>
  );
}

export function InventoryHistory() {
  const { can, exportExcel } = useAdmin();
  const list = useApi("/inventory");
  const reports = useApi(can("reports.view") ? "/reports" : null);
  const [filters, setFilters] = useState({ query: "", type: "", from: "", to: "" });
  const all = list.data || [];
  const rows = all.filter((m) => {
    const day = dayOf(m.created_at);
    return includesText(filters.query, m.product_name, m.user_name, m.note, m.id) && (!filters.type || m.type === filters.type) &&
      (!filters.from || day >= filters.from) && (!filters.to || day <= filters.to);
  });
  const paged = usePaged(rows, JSON.stringify(filters));

  const exportHistory = () => exportExcel("lich-su-kho.xlsx", [{
    name: "Lịch sử kho",
    rows: all,
    columns: [
      { header: "Mã", key: "id", width: 10 }, { header: "Thời gian", value: (row) => excelDate(row.created_at), width: 22 },
      { header: "Loại", value: (row) => (row.type === "import" ? "Nhập kho" : "Xuất kho"), width: 14 }, { header: "Mã sản phẩm", key: "product_id", width: 14 },
      { header: "Sản phẩm", value: (row) => row.product_name || `#${row.product_id}`, width: 28 }, { header: "Số lượng", key: "quantity", width: 12, number: true },
      { header: "Người ghi nhận", key: "user_name", width: 24 }, { header: "Ghi chú / chứng từ", key: "note", width: 38 },
      { header: "Trạng thái", value: (row) => (row.active === 0 || row.active === false ? "Inactive" : "Active"), width: 12 },
    ],
  }]);

  return (
    <div className="stack">
      {reports.data && (
        <div className="metric-grid">
          <Metric label="TỔNG TỒN KHO" value={Number(reports.data.totalStock || 0).toLocaleString("vi-VN")} note="đơn vị hàng" />
          <Metric label="GIÁ TRỊ KHO" value={money(reports.data.inventoryValue)} note="theo giá vốn" />
          <Metric label="ĐÃ BÁN" value={Number(reports.data.soldQuantity || 0).toLocaleString("vi-VN")} note="đơn vị qua đơn hàng" />
        </div>
      )}
      <Panel title="Lịch sử kho" subtitle={`${rows.length} / ${all.length} chứng từ`} actions={<button type="button" className="btn btn-paper btn-small" onClick={exportHistory}>Xuất Excel</button>}>
        <div className="filters">
          <SearchBox value={filters.query} onChange={(query) => setFilters({ ...filters, query })} placeholder="Tìm sản phẩm, người ghi nhận, chứng từ..." />
          <select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })} aria-label="Loại giao dịch">
            <option value="">Tất cả giao dịch</option><option value="import">Nhập kho</option><option value="export">Xuất kho</option>
          </select>
          <label className="filter-date">Từ ngày<input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} /></label>
          <label className="filter-date">Đến ngày<input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} /></label>
        </div>
        <LoadState resource={list} empty={list.data && !rows.length ? "Không có chứng từ phù hợp." : ""}>
          <div className="table-wrap">
            <table className="ledger-table">
              <thead><tr><th>Thời gian</th><th>Loại</th><th>Sản phẩm</th><th className="num">Số lượng</th><th>Người ghi nhận</th><th>Ghi chú</th></tr></thead>
              <tbody>
                {paged.visible.map((m) => (
                  <tr key={m.id}>
                    <td>{new Date(m.created_at).toLocaleString("vi-VN")}</td>
                    <td><Badge tone={m.type === "import" ? "ok" : "warn"}>{m.type === "import" ? "Nhập" : "Xuất"}</Badge></td>
                    <td>{m.product_name || `#${m.product_id}`}</td>
                    <td className="num">{m.quantity}</td>
                    <td>{m.user_name || "—"}</td>
                    <td>{m.note || "—"}{m.corrected_by && <span className="muted-line">Đã chỉnh bởi {m.corrected_by}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination paged={paged} />
        </LoadState>
      </Panel>
    </div>
  );
}

const RECORD = {
  inventory: { label: "Chứng từ kho", source: "/inventory", describe: (m) => `#${m.id} — ${m.product_name || `SP #${m.product_id}`} — ${m.type === "import" ? "nhập" : "xuất"} ${m.quantity}` },
  order: { label: "Đơn hàng", source: "/orders", describe: (o) => `${o.id} — ${o.customer}` },
};
const STATUS_TEXT = { pending: "Chờ duyệt", approved: "Đã duyệt", rejected: "Từ chối" };
const STATUS_TONE = { pending: "warn", approved: "ok", rejected: "bad" };

export function Corrections({ recordType }) {
  const { admin, run, notify, refreshAlerts } = useAdmin();
  const meta = RECORD[recordType];
  const records = useApi(meta.source);
  const requests = useApi(admin ? "/correction-requests" : null);
  const [form, setForm] = useState({ recordId: "", reason: "" });

  async function submit(event) {
    event.preventDefault();
    if (!form.recordId || !form.reason.trim()) return notify("error", "Vui lòng chọn bản ghi và nhập lý do cần điều chỉnh.");
    const ok = await run(
      () => request("/correction-requests", { method: "POST", body: { recordType, recordId: form.recordId, reason: form.reason.trim() } }),
      "Đã gửi yêu cầu điều chỉnh cho admin",
    );
    if (ok) {
      setForm({ recordId: "", reason: "" });
      requests.reload();
      refreshAlerts();
    }
  }

  async function resolve(row, status) {
    const ok = await run(() => request(`/correction-requests/${row.id}`, { method: "PATCH", body: { status } }), "Đã xử lý yêu cầu điều chỉnh");
    if (ok) {
      requests.reload();
      refreshAlerts();
    }
  }

  const mine = (requests.data || []).filter((row) => row.record_type === recordType);
  const pending = mine.filter((row) => row.status === "pending").length;

  return (
    <div className="stack">
      <Panel title="Báo sai sót cho admin" subtitle="Nhân viên không tự sửa chứng từ đã ghi nhận. Hãy gửi yêu cầu để admin kiểm tra và điều chỉnh.">
        <LoadState resource={records}>
          <form onSubmit={submit} className="stack">
            <div className="form-grid">
              <Field label="Loại dữ liệu"><input value={meta.label} readOnly /></Field>
              <Field label="Bản ghi cần sửa *">
                <select id="correction-record" value={form.recordId} onChange={(e) => setForm({ ...form, recordId: e.target.value })} required>
                  <option value="">Chọn bản ghi</option>
                  {(records.data || []).map((row) => <option key={row.id} value={row.id}>{meta.describe(row)}</option>)}
                </select>
              </Field>
              <Field label="Lý do và nội dung cần điều chỉnh *" wide>
                <textarea id="correction-reason" rows="4" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} required />
              </Field>
            </div>
            <div className="form-actions"><button type="submit" className="btn btn-door">Gửi yêu cầu cho admin</button></div>
          </form>
        </LoadState>
      </Panel>
      {admin && (
        <Panel title="Yêu cầu điều chỉnh" subtitle="Duyệt yêu cầu rồi sửa chứng từ gốc. Duyệt chỉ đổi trạng thái yêu cầu, không tự sửa dữ liệu." actions={<Badge tone={pending ? "warn" : "ok"}>{pending} chờ duyệt</Badge>}>
          <LoadState resource={requests} empty={requests.data && !mine.length ? "Chưa có yêu cầu nào." : ""}>
            <ul className="card-list">
              {mine.map((row) => (
                <li key={row.id}>
                  <span className="thumb">!</span>
                  <span className="card-text"><strong>{meta.label} #{row.record_id}</strong>{row.requested_by} · {row.reason}</span>
                  <Badge tone={STATUS_TONE[row.status]}>{STATUS_TEXT[row.status] || row.status}</Badge>
                  <span className="row-actions">
                    {row.status === "pending" && (
                      <>
                        <button type="button" className="btn btn-door btn-small" onClick={() => resolve(row, "approved")}>Duyệt</button>
                        <button type="button" className="btn btn-paper btn-small" onClick={() => resolve(row, "rejected")}>Từ chối</button>
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </LoadState>
        </Panel>
      )}
    </div>
  );
}
