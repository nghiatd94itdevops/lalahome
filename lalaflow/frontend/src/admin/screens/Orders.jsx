import { useState } from "react";
import { money } from "../../api.js";
import { request, useApi } from "../client.js";
import { useDraft } from "../drafts.js";
import { excelDate } from "../excel.js";
import { ActiveBadge, Badge, Field, LoadState, MoneyInput, Pagination, Panel, SearchBox, distinct, includesText, useAdmin, usePaged } from "../ui.jsx";

export const ORDER_STATUSES = ["Đơn mới", "Đã xác nhận", "Đang chuẩn bị", "Đang giao", "Hoàn thành", "Đã hủy", "Đã thanh toán"];
const CANCELLED = "Đã hủy";
const confirmCancel = (confirm, orderId) => confirm({
  title: "Hủy đơn hàng?",
  message: `Đơn ${orderId} sẽ được hoàn lại toàn bộ sản phẩm vào kho. Đơn đã hủy không thể mở lại; muốn bán lại phải tạo đơn mới.`,
  confirmLabel: "Hủy đơn và hoàn kho",
  cancelLabel: "Giữ đơn",
});
const ORDER_TONE = { "Đơn mới": "neutral", "Đã xác nhận": "neutral", "Đang chuẩn bị": "warn", "Đang giao": "warn", "Hoàn thành": "ok", "Đã thanh toán": "ok", "Đã hủy": "bad", "Đã xử lý": "ok" };
const PAYMENT_METHODS = ["Chuyển khoản", "Tiền mặt", "Thẻ"];
const TAX_CODE = /^[0-9-]{8,20}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const OrderStatus = ({ status }) => <Badge tone={ORDER_TONE[status] || "neutral"}>{status}</Badge>;
const emptyLine = () => ({ productId: "", quantity: "1", unitPrice: "" });
const today = () => new Date().toISOString().slice(0, 10);

// Mirrors the backend rules in POST /orders so the preview matches what gets saved.
export function discountPreview(subtotal, code, manualPercent) {
  if (code) {
    const raw = code.discount_type === "fixed" ? Math.round(code.discount_value) : Math.round((subtotal * code.discount_value) / 100);
    const capped = code.max_discount_amount ? Math.min(raw, code.max_discount_amount) : raw;
    return Math.min(capped, subtotal);
  }
  const percent = Number(manualPercent || 0);
  return percent > 0 ? Math.min(Math.round((subtotal * percent) / 100), subtotal) : 0;
}

function codeProblem(code, subtotal) {
  if (!code) return "";
  const day = today();
  if (code.starts_at && String(code.starts_at).slice(0, 10) > day) return "Mã chưa đến ngày sử dụng.";
  if (code.expires_at && String(code.expires_at).slice(0, 10) < day) return "Mã đã hết hạn.";
  if (code.usage_limit && code.used_count >= code.usage_limit) return "Mã đã hết lượt sử dụng.";
  if (subtotal < code.min_order_amount) return `Đơn cần tối thiểu ${money(code.min_order_amount)} để dùng mã này.`;
  return "";
}

const codeLabel = (code) => `${code.code} — ${code.discount_type === "fixed" ? money(code.discount_value) : `${Number(code.discount_value)}%`}`;

export function OrderCreate() {
  const { user, can, run, notify, goTo } = useAdmin();
  const draft = useDraft("order");
  const products = useApi("/products?all=1");
  const codes = useApi(can("orders.view") ? "/discount-codes" : null);
  const blank = { customer: "", customerPhone: "", customerEmail: "", taxCode: "", invoiceName: "", invoiceAddress: "", employeeName: user.name || "", paidAmount: "", discountCode: "", discountPercent: "", creditOverrideReason: "" };
  const [form, setForm] = useState(() => ({ ...blank, ...(draft?.form || {}) }));
  const [lines, setLines] = useState(() => draft?.lines?.length ? draft.lines : [emptyLine()]);
  const [busy, setBusy] = useState(false);
  const [creditNotice, setCreditNotice] = useState("");

  const activeProducts = (products.data || []).filter((p) => p.active);
  const activeCodes = (codes.data || []).filter((c) => c.active);
  const selectedCode = activeCodes.find((c) => c.code === form.discountCode) || null;
  const subtotal = lines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unitPrice || 0), 0);
  const discount = discountPreview(subtotal, selectedCode, form.discountPercent);
  const total = subtotal - discount;
  const debt = Math.max(total - Number(form.paidAmount || 0), 0);
  const problem = codeProblem(selectedCode, subtotal);
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });
  const setLine = (index, patch) => setLines(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  const chooseProduct = (index, productId) => {
    const product = activeProducts.find((p) => String(p.id) === productId);
    setLine(index, { productId, unitPrice: product ? String(product.price) : "" });
  };

  async function submit(event) {
    event.preventDefault();
    if (!form.customer.trim()) return notify("error", "Vui lòng nhập tên khách hàng hoặc công ty.");
    const chosen = lines.filter((line) => line.productId);
    if (!chosen.length) return notify("error", "Đơn hàng phải có ít nhất một sản phẩm hợp lệ.");
    for (const line of chosen) {
      const product = activeProducts.find((p) => String(p.id) === line.productId);
      const quantity = Number(line.quantity);
      if (!Number.isInteger(quantity) || quantity < 1) return notify("error", "Số lượng bán phải là số nguyên lớn hơn 0.");
      if (product && quantity > Number(product.stock)) return notify("error", `${product.name} chỉ còn ${product.stock} ${product.unit} trong kho.`);
      // The server sells a line at exactly this price, 0 included, so a cleared field must not slip through as free.
      if (String(line.unitPrice).trim() === "") return notify("error", `Nhập đơn giá cho ${product?.name || "sản phẩm"} (nhập 0 nếu là hàng tặng).`);
    }
    const percent = Number(form.discountPercent || 0);
    if (!selectedCode && (percent < 0 || percent > 100)) return notify("error", "Chiết khấu phần trăm phải từ 0 đến 100.");
    if (problem) return notify("error", problem);
    const paid = Number(form.paidAmount || 0);
    if (paid > total) return notify("error", "Số tiền khách thanh toán không được lớn hơn tổng đơn hàng.");
    if (form.customerEmail && !EMAIL.test(form.customerEmail.trim())) return notify("error", "Email khách hàng không hợp lệ.");

    setBusy(true);
    let created = null;
    const ok = await run(async () => {
      created = await request("/orders", {
        method: "POST",
        body: {
          ...form, customer: form.customer.trim(), status: "Đơn mới", paidAmount: paid,
          discountCode: selectedCode ? selectedCode.code : "", discountPercent: selectedCode ? 0 : percent,
          items: chosen.map((line) => ({ productId: Number(line.productId), quantity: Number(line.quantity), unitPrice: Number(line.unitPrice || 0) })),
        },
      }).catch((error) => {
        // Only admins get this code: the backend lets them through once they give a reason.
        if (error.code === "CREDIT_LIMIT") setCreditNotice(error.message);
        throw error;
      });
    });
    setBusy(false);
    if (!ok) return;
    notify("success", `Đã tạo đơn ${created.id} (${money(created.total)}) và tự động xuất kho.`);
    setForm(blank);
    setCreditNotice("");
    setLines([emptyLine()]);
    products.reload();
    codes.reload();
    goTo("orders_list");
  }

  return (
    <LoadState resource={products}>
      <form onSubmit={submit} className="stack">
        {draft?.note && <p className="load-note">{draft.note}</p>}
        <Panel title="Ghi nhận đơn hàng" subtitle="Tạo đơn sẽ tự động trừ tồn kho và ghi phiếu xuất.">
          <div className="stack">
            <fieldset className="subgroup">
              <legend>Khách hàng & nhân viên bán hàng</legend>
              <div className="form-grid">
                <Field label="Tên khách hàng / công ty *"><input id="order-customer" value={form.customer} onChange={set("customer")} required /></Field>
                <Field label="Nhân viên phụ trách"><input id="order-employee" value={form.employeeName} onChange={set("employeeName")} /></Field>
                <Field label="Số điện thoại"><input id="order-phone" type="tel" value={form.customerPhone} onChange={set("customerPhone")} /></Field>
                <Field label="Email"><input id="order-email" type="email" value={form.customerEmail} onChange={set("customerEmail")} /></Field>
              </div>
            </fieldset>
            <fieldset className="subgroup">
              <legend>Thông tin xuất hóa đơn</legend>
              <div className="form-grid">
                <Field label="Tên đơn vị xuất hóa đơn"><input id="order-invoice-name" value={form.invoiceName} onChange={set("invoiceName")} /></Field>
                <Field label="Mã số thuế"><input id="order-tax" value={form.taxCode} onChange={set("taxCode")} /></Field>
                <Field label="Địa chỉ hóa đơn" wide><textarea id="order-invoice-address" rows="2" value={form.invoiceAddress} onChange={set("invoiceAddress")} /></Field>
              </div>
            </fieldset>
            <fieldset className="subgroup">
              <legend>Sản phẩm bán</legend>
              <div className="line-items">
                {lines.map((line, index) => (
                  <div className="line-item" key={index}>
                    <select aria-label="Sản phẩm" value={line.productId} onChange={(e) => chooseProduct(index, e.target.value)}>
                      <option value="">Chọn sản phẩm</option>
                      {activeProducts.map((p) => <option key={p.id} value={p.id}>{p.name} — tồn {p.stock}</option>)}
                    </select>
                    <input aria-label="Số lượng" type="number" min="1" value={line.quantity} onChange={(e) => setLine(index, { quantity: e.target.value })} />
                    <MoneyInput aria-label="Đơn giá" placeholder="Đơn giá" value={line.unitPrice} onChange={(value) => setLine(index, { unitPrice: value })} />
                    <span className="line-total">{money(Number(line.quantity || 0) * Number(line.unitPrice || 0))}</span>
                    <button type="button" className="icon-button" aria-label="Xóa dòng" onClick={() => setLines(lines.length > 1 ? lines.filter((_, i) => i !== index) : [emptyLine()])}>×</button>
                  </div>
                ))}
              </div>
              <button type="button" className="btn btn-paper btn-small" onClick={() => setLines([...lines, emptyLine()])}>+ Thêm dòng sản phẩm</button>
            </fieldset>
          </div>
        </Panel>

        <Panel title="Chiết khấu & thanh toán" subtitle="Chọn mã đã tạo hoặc nhập trực tiếp tỷ lệ dành cho đối tác.">
          <div className="form-grid form-grid-3">
            <Field label="Mã chiết khấu" hint={problem || undefined}>
              <select id="order-code" value={form.discountCode} onChange={set("discountCode")}>
                <option value="">Không dùng mã</option>
                {activeCodes.map((code) => <option key={code.id} value={code.code}>{codeLabel(code)}</option>)}
              </select>
            </Field>
            <Field label="Hoặc nhập trực tiếp (%)">
              <input id="order-percent" type="number" min="0" max="100" step="0.01" value={form.discountPercent} onChange={set("discountPercent")} disabled={Boolean(selectedCode)} />
            </Field>
            <Field label="Khách thanh toán (đ)"><MoneyInput id="order-paid" value={form.paidAmount} onChange={(value) => setForm({ ...form, paidAmount: value })} /></Field>
            {creditNotice && (
              <Field label="Lý do tạo đơn vượt hạn mức (admin) *" hint={creditNotice} wide>
                <textarea id="order-credit-reason" rows="2" value={form.creditOverrideReason} onChange={set("creditOverrideReason")} required />
              </Field>
            )}
          </div>
          <dl className="summary-lines">
            <div><dt>Tiền hàng</dt><dd>{money(subtotal)}</dd></div>
            <div><dt>Chiết khấu</dt><dd>- {money(discount)}</dd></div>
            <div><dt>Thực thu</dt><dd>{money(total)}</dd></div>
            <div><dt>Công nợ còn lại</dt><dd className={debt ? "text-warn" : ""}>{money(debt)}</dd></div>
          </dl>
          <div className="form-actions"><button type="submit" className="btn btn-door btn-large" disabled={busy}>{busy ? "Đang tạo đơn…" : "Tạo đơn & xuất kho"}</button></div>
        </Panel>
      </form>
    </LoadState>
  );
}

function OrderDetail({ order, onSaved, onClose }) {
  const { can, admin, run, notify, confirm } = useAdmin();
  const [form, setForm] = useState({ status: order.status, invoiceName: order.invoice_name || "", taxCode: order.tax_code || "", customerEmail: order.customer_email || "", invoiceAddress: order.invoice_address || "" });
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });
  const editable = can("orders.change_status");
  const isCancelled = order.status === CANCELLED;

  async function save(event) {
    event.preventDefault();
    if (form.status === CANCELLED && !isCancelled && !(await confirmCancel(confirm, order.id))) return;
    if (form.taxCode && !TAX_CODE.test(form.taxCode.trim())) return notify("error", "Mã số thuế chỉ gồm 8–20 chữ số hoặc dấu gạch ngang.");
    if (form.customerEmail && !EMAIL.test(form.customerEmail.trim())) return notify("error", "Email nhận hóa đơn không hợp lệ.");
    const ok = await run(() => request(`/orders/${order.id}/invoice`, { method: "PATCH", body: form }), "Đã cập nhật trạng thái và thông tin xuất hóa đơn");
    if (ok) onSaved();
  }

  async function toggleActive() {
    const next = !order.active;
    if (!next && !(await confirm({ title: "Vô hiệu đơn hàng?", message: `Đơn ${order.id} sẽ không còn tính vào doanh thu, công nợ và báo cáo. Tồn kho không được hoàn lại.`, confirmLabel: "Vô hiệu đơn" }))) return;
    const ok = await run(() => request(`/orders/${order.id}/active`, { method: "PATCH", body: { active: next } }), next ? "Đã khôi phục đơn hàng" : "Đã vô hiệu đơn hàng");
    if (ok) onSaved();
  }

  return (
    <Panel
      title={`Đơn hàng ${order.id}`}
      subtitle={`${order.customer} · Nhân viên ${order.employee_name || "—"} · ${new Date(order.created_at).toLocaleString("vi-VN")}`}
      actions={<><OrderStatus status={order.status} /><ActiveBadge active={order.active} /><button type="button" className="btn btn-paper btn-small" onClick={onClose}>Đóng</button></>}
    >
      <div className="stack">
        <dl className="summary-lines">
          <div><dt>Tiền hàng</dt><dd>{money(order.subtotal)}</dd></div>
          <div><dt>Chiết khấu{order.discount_code ? ` (${order.discount_code})` : ""}</dt><dd>- {money(order.discount_amount)}</dd></div>
          <div><dt>Thành tiền</dt><dd>{money(order.total)}</dd></div>
          <div><dt>Đã thu / Công nợ</dt><dd>{money(order.paid_amount)} / <span className={order.debt_amount ? "text-warn" : ""}>{money(order.debt_amount)}</span></dd></div>
        </dl>
        <div className="table-wrap">
          <table className="ledger-table">
            <thead><tr><th>Sản phẩm</th><th className="num">Số lượng</th><th className="num">Đơn giá</th><th className="num">Thành tiền</th></tr></thead>
            <tbody>{order.items.map((item) => <tr key={item.id}><td>{item.product_name}</td><td className="num">{item.quantity}</td><td className="num">{money(item.unit_price)}</td><td className="num">{money(item.line_total)}</td></tr>)}</tbody>
          </table>
        </div>
        {order.payments?.length > 0 && (
          <fieldset className="subgroup">
            <legend>Lịch sử thanh toán</legend>
            <ul className="row-list">
              {order.payments.map((p) => <li key={p.id}><span><strong>{money(p.amount)}</strong>{p.method} · {p.note || "—"} · {p.user_name}</span><span>{new Date(p.created_at).toLocaleString("vi-VN")}</span></li>)}
            </ul>
          </fieldset>
        )}
        <p className="field-hint">Sản phẩm, số lượng và đơn giá chỉ được xem. Sai sót gửi qua mục “Báo sai sót đơn”.</p>
        {editable && (
          <form onSubmit={save} className="stack">
            <div className="form-grid">
              <Field label="Trạng thái đơn" hint={isCancelled ? "Đơn đã hủy và đã hoàn kho, không đổi trạng thái được." : undefined}>
                <select id="detail-status" value={form.status} onChange={set("status")} disabled={isCancelled}>{ORDER_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
              </Field>
              <Field label="Tên đơn vị xuất hóa đơn"><input value={form.invoiceName} onChange={set("invoiceName")} /></Field>
              <Field label="Mã số thuế"><input value={form.taxCode} onChange={set("taxCode")} /></Field>
              <Field label="Email nhận hóa đơn"><input type="email" value={form.customerEmail} onChange={set("customerEmail")} /></Field>
              <Field label="Địa chỉ xuất hóa đơn" wide><textarea rows="2" value={form.invoiceAddress} onChange={set("invoiceAddress")} /></Field>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-door">Lưu thông tin đơn hàng</button>
              {admin && <button type="button" className="btn btn-paper" onClick={toggleActive}>{order.active ? "Vô hiệu đơn" : "Khôi phục đơn"}</button>}
            </div>
          </form>
        )}
      </div>
    </Panel>
  );
}

export function OrdersList() {
  const { exportExcel } = useAdmin();
  const list = useApi("/orders");
  const [openId, setOpenId] = useState(null);
  const [filters, setFilters] = useState({ query: "", status: "", debt: "", employee: "" });
  const all = list.data || [];
  const rows = all.filter((o) =>
    includesText(filters.query, o.id, o.customer, o.customer_phone, o.customer_email, o.employee_name, o.tax_code) &&
    (!filters.status || o.status === filters.status) &&
    (!filters.employee || o.employee_name === filters.employee) &&
    (filters.debt !== "owing" || o.debt_amount > 0) && (filters.debt !== "paid" || o.debt_amount === 0));
  const paged = usePaged(rows, JSON.stringify(filters));
  const open = all.find((o) => o.id === openId);
  const discounted = all.filter((o) => o.discount_amount > 0);

  const exportOrders = () => exportExcel("danh-sach-don-hang.xlsx", [{
    name: "Đơn hàng", rows: all,
    columns: [
      { header: "Mã đơn", key: "id", width: 22 }, { header: "Ngày tạo", value: (r) => excelDate(r.created_at), width: 22 }, { header: "Khách hàng", key: "customer", width: 28 },
      { header: "Điện thoại", key: "customer_phone", width: 16 }, { header: "Email", key: "customer_email", width: 26 }, { header: "Nhân viên", key: "employee_name", width: 20 },
      { header: "Tiền hàng", key: "subtotal", width: 16, number: true }, { header: "Chiết khấu", key: "discount_amount", width: 14, number: true },
      { header: "Tổng tiền", key: "total", width: 16, number: true }, { header: "Đã thu", key: "paid_amount", width: 16, number: true },
      { header: "Công nợ", key: "debt_amount", width: 16, number: true }, { header: "Mã số thuế", key: "tax_code", width: 16 },
      { header: "Tên xuất hóa đơn", key: "invoice_name", width: 26 }, { header: "Trạng thái", key: "status", width: 16 },
    ],
  }]);

  return (
    <div className="stack">
      {open && <OrderDetail key={`${open.id}-${open.status}-${open.active}`} order={open} onSaved={list.reload} onClose={() => setOpenId(null)} />}
      <Panel title="Danh sách đơn hàng" subtitle={`${rows.length} / ${all.length} đơn`} actions={<button type="button" className="btn btn-paper btn-small" onClick={exportOrders}>Xuất Excel</button>}>
        <div className="filters">
          <SearchBox value={filters.query} onChange={(query) => setFilters({ ...filters, query })} placeholder="Tìm mã đơn, khách hàng, điện thoại, MST..." />
          <select aria-label="Trạng thái" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option value="">Tất cả trạng thái</option>{distinct(all, (o) => o.status).map((s) => <option key={s}>{s}</option>)}</select>
          <select aria-label="Công nợ" value={filters.debt} onChange={(e) => setFilters({ ...filters, debt: e.target.value })}><option value="">Tất cả công nợ</option><option value="owing">Còn nợ</option><option value="paid">Đã thanh toán đủ</option></select>
          <select aria-label="Nhân viên" value={filters.employee} onChange={(e) => setFilters({ ...filters, employee: e.target.value })}><option value="">Tất cả nhân viên</option>{distinct(all, (o) => o.employee_name).map((s) => <option key={s}>{s}</option>)}</select>
        </div>
        <LoadState resource={list} empty={list.data && !rows.length ? "Không có đơn hàng phù hợp." : ""}>
          <div className="table-wrap">
            <table className="ledger-table">
              <thead><tr><th>Mã đơn</th><th>Khách hàng</th><th>Nhân viên</th><th className="num">Tổng tiền</th><th className="num">Đã thu</th><th className="num">Công nợ</th><th>Hóa đơn</th><th>Trạng thái</th><th /></tr></thead>
              <tbody>
                {paged.visible.map((o) => (
                  <tr key={o.id} className={o.active ? "" : "is-off"}>
                    <td><strong>{o.id}</strong><span className="muted-line">{new Date(o.created_at).toLocaleDateString("vi-VN")}</span></td>
                    <td>{o.customer}<span className="muted-line">{o.customer_phone || ""}</span></td>
                    <td>{o.employee_name || "—"}</td>
                    <td className="num">{money(o.total)}</td>
                    <td className="num">{money(o.paid_amount)}</td>
                    <td className={`num ${o.debt_amount ? "text-warn" : ""}`}>{money(o.debt_amount)}</td>
                    <td>{o.invoice_name || "—"}<span className="muted-line">{o.tax_code || ""}</span></td>
                    <td><OrderStatus status={o.status} /></td>
                    <td><button type="button" className="btn btn-paper btn-small" onClick={() => { setOpenId(o.id); window.scrollTo({ top: 0 }); }}>Xem chi tiết</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination paged={paged} />
        </LoadState>
      </Panel>
      {discounted.length > 0 && (
        <Panel title="Chiết khấu đã ghi nhận" subtitle="Đối soát doanh thu gốc và thực nhận theo từng đơn.">
          <div className="table-wrap">
            <table className="ledger-table">
              <thead><tr><th>Mã đơn</th><th className="num">Tiền hàng</th><th>Mã / mức giảm</th><th className="num">Tiền chiết khấu</th><th className="num">Doanh thu thực</th></tr></thead>
              <tbody>{discounted.map((o) => <tr key={o.id}><td>{o.id}</td><td className="num">{money(o.subtotal)}</td><td>{o.discount_code || `${Number(o.discount_value)}%`}</td><td className="num">{money(o.discount_amount)}</td><td className="num">{money(o.total)}</td></tr>)}</tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}

export function OrdersPayment() {
  const { run, notify } = useAdmin();
  const list = useApi("/orders");
  const [form, setForm] = useState({ orderId: "", amount: "", method: PAYMENT_METHODS[0], note: "" });
  const owing = (list.data || []).filter((o) => o.active && o.status !== CANCELLED && o.debt_amount > 0);
  const order = owing.find((o) => o.id === form.orderId);

  async function submit(event) {
    event.preventDefault();
    const amount = Number(form.amount || 0);
    if (!order) return notify("error", "Vui lòng chọn đơn hàng cần thu công nợ.");
    if (amount <= 0) return notify("error", "Số tiền thu phải lớn hơn 0.");
    if (amount > order.debt_amount) return notify("error", `Số tiền thu ${money(amount)} lớn hơn công nợ còn lại ${money(order.debt_amount)} của đơn ${order.id}.`);
    const ok = await run(() => request(`/orders/${order.id}/payments`, { method: "POST", body: { amount, method: form.method, note: form.note.trim() } }), "Đã ghi nhận thanh toán công nợ");
    if (ok) {
      setForm({ orderId: "", amount: "", method: PAYMENT_METHODS[0], note: "" });
      list.reload();
    }
  }

  return (
    <Panel title="Thu tiền công nợ" subtitle="Chỉ hiện các đơn đang hoạt động còn công nợ. Thu đủ thì đơn tự chuyển “Đã thanh toán”.">
      <LoadState resource={list} empty={list.data && !owing.length ? "Không còn đơn nào đang nợ." : ""}>
        <form onSubmit={submit} className="stack">
          <div className="form-grid">
            <Field label="Đơn hàng *">
              <select id="pay-order" value={form.orderId} onChange={(e) => setForm({ ...form, orderId: e.target.value, amount: "" })} required>
                <option value="">Chọn đơn hàng</option>
                {owing.map((o) => <option key={o.id} value={o.id}>{o.id} — {o.customer} — nợ {money(o.debt_amount)}</option>)}
              </select>
            </Field>
            <Field label="Số tiền (đ) *" hint={order ? `Còn nợ ${money(order.debt_amount)}` : undefined}>
              <MoneyInput id="pay-amount" value={form.amount} onChange={(value) => setForm({ ...form, amount: value })} />
            </Field>
            <Field label="Phương thức"><select id="pay-method" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>{PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}</select></Field>
            <Field label="Ghi chú"><input id="pay-note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-door">Ghi nhận thanh toán</button>
            {order && <button type="button" className="btn btn-paper" onClick={() => setForm({ ...form, amount: String(order.debt_amount) })}>Thu đủ {money(order.debt_amount)}</button>}
          </div>
        </form>
      </LoadState>
    </Panel>
  );
}

export function OrdersStatus() {
  const { run, notify, confirm } = useAdmin();
  const list = useApi("/orders");
  const [form, setForm] = useState({ orderId: "", status: "Đã xác nhận" });
  const active = (list.data || []).filter((o) => o.active && o.status !== CANCELLED);

  async function submit(event) {
    event.preventDefault();
    if (!form.orderId) return notify("error", "Vui lòng chọn đơn hàng.");
    if (form.status === CANCELLED && !(await confirmCancel(confirm, form.orderId))) return;
    const ok = await run(() => request(`/orders/${form.orderId}/status`, { method: "PATCH", body: { status: form.status } }), "Đã cập nhật trạng thái đơn hàng");
    if (ok) list.reload();
  }

  return (
    <Panel title="Cập nhật trạng thái đơn hàng" subtitle="Chuyển sang “Đã hủy” sẽ tự hoàn sản phẩm vào kho; đơn đã hủy không mở lại được.">
      <LoadState resource={list}>
        <form onSubmit={submit} className="stack">
          <div className="form-grid">
            <Field label="Đơn hàng *">
              <select id="status-order" value={form.orderId} onChange={(e) => setForm({ ...form, orderId: e.target.value })} required>
                <option value="">Chọn đơn hàng</option>
                {active.map((o) => <option key={o.id} value={o.id}>{o.id} — {o.customer} — {o.status}</option>)}
              </select>
            </Field>
            <Field label="Trạng thái mới">
              <select id="status-value" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {ORDER_STATUSES.filter((s) => s !== "Đã thanh toán").map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
          </div>
          <div className="form-actions"><button type="submit" className="btn btn-door">Cập nhật trạng thái</button></div>
        </form>
      </LoadState>
    </Panel>
  );
}

const EMPTY_CODE = { code: "", name: "", discountType: "percent", discountValue: "", minOrderAmount: "", maxDiscountAmount: "", usageLimit: "", startsAt: "", expiresAt: "", active: true };
const codeToForm = (c) => ({
  id: c.id, code: c.code, name: c.name, discountType: c.discount_type, discountValue: String(Number(c.discount_value)),
  minOrderAmount: String(c.min_order_amount || ""), maxDiscountAmount: String(c.max_discount_amount || ""), usageLimit: String(c.usage_limit || ""),
  startsAt: c.starts_at ? String(c.starts_at).slice(0, 10) : "", expiresAt: c.expires_at ? String(c.expires_at).slice(0, 10) : "", active: Boolean(c.active),
});

export function DiscountCodes() {
  const { run, notify } = useAdmin();
  const list = useApi("/discount-codes");
  const [form, setForm] = useState(EMPTY_CODE);
  const editing = Boolean(form.id);
  const isFixed = form.discountType === "fixed";
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  async function submit(event) {
    event.preventDefault();
    const value = Number(form.discountValue || 0);
    if (!form.code.trim() || !form.name.trim()) return notify("error", "Vui lòng nhập mã và tên chương trình chiết khấu.");
    if (value <= 0) return notify("error", "Mức chiết khấu phải lớn hơn 0.");
    if (!isFixed && value > 100) return notify("error", "Chiết khấu phần trăm không được vượt quá 100%.");
    if (form.startsAt && form.expiresAt && form.startsAt > form.expiresAt) return notify("error", "Ngày hết hạn phải sau ngày bắt đầu.");
    const body = {
      ...form, code: form.code.trim().toUpperCase(), name: form.name.trim(), discountValue: value,
      minOrderAmount: Number(form.minOrderAmount || 0), maxDiscountAmount: Number(form.maxDiscountAmount || 0) || null,
      usageLimit: Number(form.usageLimit || 0) || null, startsAt: form.startsAt || null, expiresAt: form.expiresAt || null,
    };
    const ok = await run(() => request(editing ? `/discount-codes/${form.id}` : "/discount-codes", { method: editing ? "PUT" : "POST", body }), editing ? "Đã cập nhật mã chiết khấu" : "Đã tạo mã chiết khấu");
    if (ok) {
      setForm(EMPTY_CODE);
      list.reload();
    }
  }

  return (
    <div className="stack">
      <Panel title={editing ? "Cập nhật mã chiết khấu" : "Tạo mã chiết khấu"} subtitle="Thiết lập ưu đãi theo phần trăm hoặc số tiền cố định.">
        <form onSubmit={submit} className="stack">
          <div className="form-grid form-grid-3">
            <Field label="Mã chiết khấu *"><input id="code-code" value={form.code} onChange={set("code")} style={{ textTransform: "uppercase" }} required /></Field>
            <Field label="Tên chương trình *"><input id="code-name" value={form.name} onChange={set("name")} required /></Field>
            <Field label="Loại chiết khấu"><select id="code-type" value={form.discountType} onChange={set("discountType")}><option value="percent">Phần trăm (%)</option><option value="fixed">Số tiền cố định</option></select></Field>
            <Field label={isFixed ? "Số tiền chiết khấu (đ) *" : "Mức chiết khấu (%) *"}>
              {isFixed ? <MoneyInput id="code-value" value={form.discountValue} onChange={(v) => setForm({ ...form, discountValue: v })} /> : <input id="code-value" type="number" min="0" max="100" step="0.01" value={form.discountValue} onChange={set("discountValue")} />}
            </Field>
            <Field label="Đơn tối thiểu (đ)"><MoneyInput id="code-min" value={form.minOrderAmount} onChange={(v) => setForm({ ...form, minOrderAmount: v })} /></Field>
            <Field label="Giảm tối đa (đ)" hint="Để trống nếu không giới hạn"><MoneyInput id="code-max" value={form.maxDiscountAmount} onChange={(v) => setForm({ ...form, maxDiscountAmount: v })} /></Field>
            <Field label="Giới hạn lượt dùng" hint="Để trống nếu không giới hạn"><input id="code-limit" type="number" min="1" value={form.usageLimit} onChange={set("usageLimit")} /></Field>
            <Field label="Ngày bắt đầu"><input id="code-start" type="date" value={form.startsAt} onChange={set("startsAt")} /></Field>
            <Field label="Ngày hết hạn"><input id="code-end" type="date" value={form.expiresAt} onChange={set("expiresAt")} /></Field>
          </div>
          <label className="check"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Đang active</label>
          <div className="form-actions">
            <button type="submit" className="btn btn-door">{editing ? "Lưu thay đổi" : "Tạo mã"}</button>
            {editing && <button type="button" className="btn btn-paper" onClick={() => setForm(EMPTY_CODE)}>Hủy</button>}
          </div>
        </form>
      </Panel>
      <Panel title="Danh sách mã chiết khấu">
        <LoadState resource={list} empty={list.data && !list.data.length ? "Chưa có mã chiết khấu." : ""}>
          <ul className="card-list">
            {(list.data || []).map((c) => (
              <li key={c.id} className={c.active ? "" : "is-off"}>
                <span className="thumb">%</span>
                <span className="card-text">
                  <strong>{c.code} — {c.name}</strong>
                  {c.discount_type === "fixed" ? money(c.discount_value) : `${Number(c.discount_value)}%`} · đã dùng {c.used_count}{c.usage_limit ? `/${c.usage_limit}` : ""}
                  {c.expires_at ? ` · hết hạn ${new Date(c.expires_at).toLocaleDateString("vi-VN")}` : ""}
                </span>
                <ActiveBadge active={c.active} />
                <span className="row-actions"><button type="button" className="btn btn-paper btn-small" onClick={() => setForm(codeToForm(c))}>Sửa</button></span>
              </li>
            ))}
          </ul>
        </LoadState>
      </Panel>
    </div>
  );
}
