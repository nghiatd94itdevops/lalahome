import { useState } from "react";
import { formatDate, money } from "../../api.js";
import { request, requestBlob, useApi } from "../client.js";
import { putDraft, useDraft } from "../drafts.js";
import { excelDate } from "../excel.js";
import { ActiveBadge, Badge, Field, LoadState, Metric, MoneyInput, Pagination, Panel, SearchBox, distinct, includesText, useAdmin, usePaged } from "../ui.jsx";

const CUSTOMER_TYPES = ["Khách hàng", "Đối tác", "Đại lý", "VIP"];
const QUOTE_STATUSES = ["Nháp", "Đã gửi", "Đã chấp nhận", "Từ chối", "Hết hạn"];
const REQUEST_STATUSES = ["Mới", "Đang tư vấn", "Đã báo giá", "Hoàn tất", "Từ chối"];
const REQUEST_TONE = { "Mới": "warn", "Đang tư vấn": "neutral", "Đã báo giá": "neutral", "Hoàn tất": "ok", "Từ chối": "bad" };

export function Dashboard() {
  const { goTo } = useAdmin();
  const dashboard = useApi("/dashboard");
  const reports = useApi("/reports");
  const d = dashboard.data;
  const r = reports.data;
  const margin = r && r.revenue ? Math.round((r.estimatedProfit / r.revenue) * 100) : 0;

  return (
    <LoadState resource={dashboard}>
      {d && (
        <div className="stack">
          <div className="metric-grid">
            <Metric label="DOANH THU" value={money(d.revenue)} />
            <Metric label="ĐƠN HÀNG" value={d.orderCount} />
            <Metric label="CÔNG NỢ" value={money(d.debt)} tone="warn" />
            <Metric label="SẮP HẾT KHO" value={d.lowStock} />
            <Metric label="YÊU CẦU MỚI" value={d.newQuoteRequests} />
          </div>
          {r ? (
            <dl className="summary-lines">
              <div><dt>Giá vốn ước tính</dt><dd>{money(r.estimatedCost)}</dd></div>
              <div><dt>Lợi nhuận gộp ước tính</dt><dd>{money(r.estimatedProfit)}</dd></div>
              <div><dt>Biên lợi nhuận</dt><dd>{margin}%</dd></div>
            </dl>
          ) : (
            reports.status === "error" && <p className="load-note is-error">Không tải được số liệu lợi nhuận: {reports.error}</p>
          )}
          {d.recentRequests && (
          <Panel title="Yêu cầu tư vấn gần đây" subtitle="Các yêu cầu mới gửi từ website." actions={<button type="button" className="btn btn-paper btn-small" onClick={() => goTo("quote_requests")}>Mở danh sách</button>}>
            {d.recentRequests?.length ? (
              <ul className="row-list">
                {d.recentRequests.map((row) => (
                  <li key={row.id}>
                    <span><strong>{row.customer_name}</strong>{row.phone} · {row.product_name || "Chưa chọn sản phẩm"}</span>
                    <Badge tone={REQUEST_TONE[row.status]}>{row.status}</Badge>
                  </li>
                ))}
              </ul>
            ) : <p className="load-note">Chưa có yêu cầu nào.</p>}
          </Panel>
          )}
        </div>
      )}
    </LoadState>
  );
}

const EMPTY_CUSTOMER = { name: "", phone: "", email: "", taxCode: "", customerType: CUSTOMER_TYPES[0], creditLimit: "", paymentTermDays: "0", assignedEmployee: "", address: "", notes: "", active: true };
const customerToForm = (c) => ({
  id: c.id, name: c.name || "", phone: c.phone || "", email: c.email || "", taxCode: c.tax_code || "", customerType: c.customer_type || CUSTOMER_TYPES[0],
  creditLimit: String(c.credit_limit || ""), paymentTermDays: String(c.payment_term_days ?? 0), assignedEmployee: c.assigned_employee || "",
  address: c.address || "", notes: c.notes || "", active: Boolean(c.active),
});

export function Customers() {
  const { user, can, run, notify, exportExcel } = useAdmin();
  const list = useApi("/customers");
  const [form, setForm] = useState({ ...EMPTY_CUSTOMER, assignedEmployee: user.name || "" });
  const [filters, setFilters] = useState({ query: "", type: "", state: "" });
  const canManage = can("customers.manage");
  const editing = Boolean(form.id);
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });
  const all = list.data || [];
  const rows = all.filter((c) =>
    includesText(filters.query, c.name, c.phone, c.email, c.tax_code) && (!filters.type || c.customer_type === filters.type) &&
    (!filters.state || (filters.state === "active" ? c.active : !c.active)));
  const paged = usePaged(rows, JSON.stringify(filters));

  async function submit(event) {
    event.preventDefault();
    if (!form.name.trim()) return notify("error", "Vui lòng nhập tên khách hàng.");
    const days = Number(form.paymentTermDays || 0);
    if (!Number.isInteger(days) || days < 0) return notify("error", "Số ngày thanh toán phải là số nguyên không âm.");
    const body = { ...form, name: form.name.trim(), creditLimit: Number(form.creditLimit || 0), paymentTermDays: days };
    const ok = await run(() => request(editing ? `/customers/${form.id}` : "/customers", { method: editing ? "PUT" : "POST", body }), editing ? "Đã cập nhật khách hàng" : "Đã thêm khách hàng CRM");
    if (ok) {
      setForm({ ...EMPTY_CUSTOMER, assignedEmployee: user.name || "" });
      list.reload();
    }
  }

  const exportCustomers = () => exportExcel("danh-sach-khach-hang.xlsx", [{
    name: "Khách hàng CRM", rows: all,
    columns: [
      { header: "Mã", key: "id", width: 8 }, { header: "Khách hàng / công ty", key: "name", width: 28 }, { header: "Loại khách", key: "customer_type", width: 14 },
      { header: "Điện thoại", key: "phone", width: 16 }, { header: "Email", key: "email", width: 26 }, { header: "Mã số thuế", key: "tax_code", width: 16 },
      { header: "Địa chỉ", key: "address", width: 34 }, { header: "Nhân viên phụ trách", key: "assigned_employee", width: 20 },
      { header: "Số đơn", key: "order_count", width: 10, number: true }, { header: "Doanh thu", key: "revenue", width: 16, number: true },
      { header: "Công nợ", key: "debt", width: 16, number: true }, { header: "Hạn mức", key: "credit_limit", width: 16, number: true },
      { header: "Ngày thanh toán", key: "payment_term_days", width: 14, number: true }, { header: "Trạng thái", value: (r) => (r.active ? "Active" : "Inactive"), width: 12 },
      { header: "Ghi chú", key: "notes", width: 34 },
    ],
  }]);

  return (
    <div className="stack">
      {canManage && (
        <Panel title={editing ? "Cập nhật khách hàng" : "Thêm khách hàng CRM"} subtitle="Quản lý hồ sơ, hạn mức công nợ và nhân viên phụ trách.">
          <form onSubmit={submit} className="stack">
            <div className="form-grid form-grid-3">
              <Field label="Tên khách hàng / công ty *"><input id="customer-name" value={form.name} onChange={set("name")} required /></Field>
              <Field label="Số điện thoại"><input id="customer-phone" type="tel" value={form.phone} onChange={set("phone")} /></Field>
              <Field label="Email"><input id="customer-email" type="email" value={form.email} onChange={set("email")} /></Field>
              <Field label="Mã số thuế"><input id="customer-tax" value={form.taxCode} onChange={set("taxCode")} /></Field>
              <Field label="Loại khách hàng"><select id="customer-type" value={form.customerType} onChange={set("customerType")}>{CUSTOMER_TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>
              <Field label="Hạn mức công nợ (đ)"><MoneyInput id="customer-credit" value={form.creditLimit} onChange={(v) => setForm({ ...form, creditLimit: v })} /></Field>
              <Field label="Số ngày thanh toán"><input id="customer-term" type="number" min="0" value={form.paymentTermDays} onChange={set("paymentTermDays")} /></Field>
              <Field label="Nhân viên phụ trách"><input id="customer-owner" value={form.assignedEmployee} onChange={set("assignedEmployee")} /></Field>
              <Field label="Địa chỉ" wide><textarea id="customer-address" rows="2" value={form.address} onChange={set("address")} /></Field>
              <Field label="Ghi chú chăm sóc" wide><textarea id="customer-notes" rows="2" value={form.notes} onChange={set("notes")} /></Field>
            </div>
            <label className="check"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Đang active</label>
            <div className="form-actions">
              <button type="submit" className="btn btn-door">{editing ? "Lưu khách hàng" : "Thêm khách hàng"}</button>
              {editing && <button type="button" className="btn btn-paper" onClick={() => setForm({ ...EMPTY_CUSTOMER, assignedEmployee: user.name || "" })}>Hủy</button>}
            </div>
          </form>
        </Panel>
      )}
      <Panel title="Danh sách khách hàng" subtitle={`${rows.length} / ${all.length} khách hàng`} actions={<button type="button" className="btn btn-paper btn-small" onClick={exportCustomers}>Xuất Excel</button>}>
        <div className="filters">
          <SearchBox value={filters.query} onChange={(query) => setFilters({ ...filters, query })} placeholder="Tìm tên, điện thoại, email, mã số thuế..." />
          <select aria-label="Loại khách" value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}><option value="">Tất cả loại khách</option>{distinct(all, (c) => c.customer_type).map((t) => <option key={t}>{t}</option>)}</select>
          <select aria-label="Trạng thái" value={filters.state} onChange={(e) => setFilters({ ...filters, state: e.target.value })}><option value="">Tất cả trạng thái</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
        </div>
        <LoadState resource={list} empty={list.data && !rows.length ? "Chưa có khách hàng phù hợp." : ""}>
          <div className="table-wrap">
            <table className="ledger-table">
              <thead><tr><th>Khách hàng</th><th>Liên hệ</th><th>Phụ trách</th><th className="num">Đơn hàng</th><th className="num">Doanh thu</th><th className="num">Công nợ</th><th className="num">Hạn mức</th><th /></tr></thead>
              <tbody>
                {paged.visible.map((c) => {
                  const overLimit = c.credit_limit > 0 && c.debt > c.credit_limit;
                  return (
                    <tr key={c.id} className={c.active ? "" : "is-off"}>
                      <td><strong>{c.name}</strong><span className="muted-line">{c.customer_type} · <ActiveBadge active={c.active} /></span></td>
                      <td>{c.phone || "—"}<span className="muted-line">{c.email || ""}</span></td>
                      <td>{c.assigned_employee || "—"}</td>
                      <td className="num">{c.order_count}</td>
                      <td className="num">{money(c.revenue)}</td>
                      <td className={`num ${c.debt ? "text-warn" : ""}`}>{money(c.debt)}{overLimit && <span className="muted-line">Vượt hạn mức</span>}</td>
                      <td className="num">{c.credit_limit ? money(c.credit_limit) : "—"}</td>
                      <td>{canManage && <button type="button" className="btn btn-paper btn-small" onClick={() => { setForm(customerToForm(c)); window.scrollTo({ top: 0 }); }}>Sửa</button>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination paged={paged} />
        </LoadState>
      </Panel>
    </div>
  );
}

const emptyLine = () => ({ productId: "", quantity: "1", unitPrice: "" });

export function QuotationCreate() {
  const { user, run, notify, goTo } = useAdmin();
  const draft = useDraft("quotation");
  const customers = useApi("/customers");
  const products = useApi("/products?all=1");
  const [form, setForm] = useState(() => ({ customerId: "", employeeName: user.name || "", discountPercent: "", validUntil: "", notes: "", quoteRequestId: null, ...(draft?.form || {}) }));
  const [lines, setLines] = useState(() => draft?.lines?.length ? draft.lines : [emptyLine()]);
  const activeCustomers = (customers.data || []).filter((c) => c.active || String(c.id) === String(form.customerId));
  const productList = (products.data || []).filter((p) => p.active);
  const subtotal = lines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unitPrice || 0), 0);
  const percent = Number(form.discountPercent || 0);
  const discount = Math.round((subtotal * percent) / 100);
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });
  const setLine = (index, patch) => setLines(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  const chooseProduct = (index, productId) => {
    const product = productList.find((p) => String(p.id) === productId);
    setLine(index, { productId, unitPrice: product ? String(product.price) : "" });
  };

  async function submit(event) {
    event.preventDefault();
    const customer = activeCustomers.find((c) => String(c.id) === String(form.customerId));
    const items = lines.filter((line) => line.productId).map((line) => ({ productId: Number(line.productId), quantity: Number(line.quantity), unitPrice: Number(line.unitPrice || 0) }));
    if (!customer || !items.length) return notify("error", "Vui lòng chọn khách hàng và sản phẩm báo giá.");
    if (items.some((item) => !Number.isInteger(item.quantity) || item.quantity < 1)) return notify("error", "Số lượng báo giá phải là số nguyên lớn hơn 0.");
    if (percent < 0 || percent > 100) return notify("error", "Chiết khấu phải từ 0 đến 100%.");
    const ok = await run(() => request("/quotations", {
      method: "POST",
      body: { ...form, customerId: customer.id, customerName: customer.name, discountPercent: percent, validUntil: form.validUntil || null, items },
    }), "Đã tạo báo giá mới");
    if (ok) goTo("quotations_list");
  }

  return (
    <LoadState resource={customers.status === "ready" ? products : customers}>
      <Panel title="Tạo báo giá mới" subtitle="Báo giá không làm thay đổi tồn kho.">
        <form onSubmit={submit} className="stack">
          {draft?.note && <p className="load-note">{draft.note}</p>}
          <div className="form-grid form-grid-3">
            <Field label="Khách hàng CRM *">
              <select id="quote-customer" value={form.customerId} onChange={set("customerId")} required>
                <option value="">Chọn khách hàng CRM</option>
                {activeCustomers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.phone ? ` — ${c.phone}` : ""}</option>)}
              </select>
            </Field>
            <Field label="Nhân viên phụ trách"><input id="quote-employee" value={form.employeeName} onChange={set("employeeName")} /></Field>
            <Field label="Hiệu lực đến"><input id="quote-valid" type="date" value={form.validUntil} onChange={set("validUntil")} /></Field>
            <Field label="Chiết khấu (%)"><input id="quote-discount" type="number" min="0" max="100" step="0.01" value={form.discountPercent} onChange={set("discountPercent")} /></Field>
          </div>
          <fieldset className="subgroup">
            <legend>Sản phẩm báo giá</legend>
            <div className="line-items">
              {lines.map((line, index) => (
                <div className="line-item" key={index}>
                  <select aria-label="Sản phẩm" value={line.productId} onChange={(e) => chooseProduct(index, e.target.value)}>
                    <option value="">Chọn sản phẩm</option>
                    {productList.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <input aria-label="Số lượng" type="number" min="1" value={line.quantity} onChange={(e) => setLine(index, { quantity: e.target.value })} />
                  <MoneyInput aria-label="Đơn giá" placeholder="Đơn giá" value={line.unitPrice} onChange={(value) => setLine(index, { unitPrice: value })} />
                  <span className="line-total">{money(Number(line.quantity || 0) * Number(line.unitPrice || 0))}</span>
                  <button type="button" className="icon-button" aria-label="Xóa dòng" onClick={() => setLines(lines.length > 1 ? lines.filter((_, i) => i !== index) : [emptyLine()])}>×</button>
                </div>
              ))}
            </div>
            <button type="button" className="btn btn-paper btn-small" onClick={() => setLines([...lines, emptyLine()])}>+ Thêm sản phẩm</button>
          </fieldset>
          <Field label="Điều khoản / ghi chú" wide><textarea id="quote-notes" rows="3" value={form.notes} onChange={set("notes")} /></Field>
          <dl className="summary-lines">
            <div><dt>Tiền hàng</dt><dd>{money(subtotal)}</dd></div>
            <div><dt>Chiết khấu {percent || 0}%</dt><dd>- {money(discount)}</dd></div>
            <div><dt>Tổng báo giá</dt><dd>{money(subtotal - discount)}</dd></div>
          </dl>
          <div className="form-actions"><button type="submit" className="btn btn-door">Tạo báo giá</button></div>
        </form>
      </Panel>
    </LoadState>
  );
}

function EmailForm({ quote, initial, onSent, onCancel }) {
  const { run, notify } = useAdmin();
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return notify("error", "Vui lòng nhập email khách hàng hợp lệ.");
    setBusy(true);
    const ok = await run(() => request(`/quotations/${quote.id}/send-email`, { method: "POST", body: { ...form, email: form.email.trim() } }), `Đã gửi báo giá PDF đến ${form.email.trim()}`);
    setBusy(false);
    if (ok) onSent();
  }

  return (
    <Panel title={`Gửi báo giá ${quote.id}`} subtitle="Hệ thống tự tạo PDF và đính kèm vào email. Cần cấu hình SMTP trong lalaflow/.env.">
      <form onSubmit={submit} className="stack">
        <div className="form-grid">
          <Field label="Email khách hàng *"><input id="mail-to" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></Field>
          <Field label="Tiêu đề *"><input id="mail-subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required /></Field>
          <Field label="Nội dung email" wide><textarea id="mail-body" rows="5" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></Field>
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn-door" disabled={busy}>{busy ? "Đang gửi…" : "Gửi email kèm PDF"}</button>
          <button type="button" className="btn btn-paper" onClick={onCancel}>Hủy</button>
        </div>
      </form>
    </Panel>
  );
}

function emailDefaults(quote, companyName, email, quoteRequestId) {
  return {
    email: email || "",
    subject: `Báo giá ${quote.id} từ ${companyName}`,
    message: `Kính gửi ${quote.customer_name},\n\n${companyName} gửi Quý khách báo giá ${quote.id} trong file PDF đính kèm.\n\nTrân trọng.`,
    quoteRequestId: quoteRequestId || null,
  };
}

export function QuotationList() {
  const { can, run, notify, goTo, exportExcel } = useAdmin();
  const draft = useDraft("quoteEmail");
  const list = useApi("/quotations");
  const customers = useApi("/customers");
  const site = useApi("/site-content");
  const [emailFor, setEmailFor] = useState(draft?.quoteId || null);
  const [filters, setFilters] = useState({ query: "", status: "" });
  const canManage = can("quotations.manage");
  const company = site.data?.company?.name || "LalaFlow Paper";
  const all = list.data || [];
  const rows = all.filter((q) => includesText(filters.query, q.id, q.customer_name, q.employee_name) && (!filters.status || q.status === filters.status));
  const paged = usePaged(rows, JSON.stringify(filters));
  const quoteForEmail = all.find((q) => q.id === emailFor);
  const customerOf = (q) => (customers.data || []).find((c) => c.id === q.customer_id);

  async function changeStatus(quote, status) {
    const ok = await run(() => request(`/quotations/${quote.id}/status`, { method: "PATCH", body: { status } }), "Đã cập nhật trạng thái báo giá");
    if (ok) list.reload();
  }

  async function downloadPdf(quote) {
    try {
      const blob = await requestBlob(`/quotations/${quote.id}/pdf`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${quote.id}.pdf`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      notify("error", `Không tải được PDF: ${error.message}`);
    }
  }

  function toOrder(quote) {
    const customer = customerOf(quote);
    putDraft("order", {
      note: `Dữ liệu chuyển từ báo giá ${quote.id}. Kiểm tra tồn kho trước khi tạo đơn.`,
      form: {
        customer: quote.customer_name, customerPhone: customer?.phone || "", customerEmail: customer?.email || "", taxCode: customer?.tax_code || "",
        invoiceName: customer?.name || quote.customer_name, invoiceAddress: customer?.address || "", employeeName: quote.employee_name || "",
        discountPercent: Number(quote.discount_percent) ? String(Number(quote.discount_percent)) : "",
      },
      lines: quote.items.filter((item) => item.product_id).map((item) => ({ productId: String(item.product_id), quantity: String(item.quantity), unitPrice: String(item.unit_price) })),
    });
    goTo("orders_create");
  }

  const exportQuotes = () => exportExcel("danh-sach-bao-gia.xlsx", [{
    name: "Báo giá", rows: all,
    columns: [
      { header: "Mã báo giá", key: "id", width: 20 }, { header: "Ngày tạo", value: (r) => excelDate(r.created_at), width: 22 }, { header: "Khách hàng", key: "customer_name", width: 28 },
      { header: "Nhân viên", key: "employee_name", width: 20 }, { header: "Sản phẩm", value: (r) => r.items.map((i) => `${i.product_name} x${i.quantity}`).join("; "), width: 40 },
      { header: "Tiền hàng", key: "subtotal", width: 16, number: true }, { header: "Chiết khấu (%)", key: "discount_percent", width: 12, number: true },
      { header: "Tiền chiết khấu", key: "discount_amount", width: 16, number: true }, { header: "Tổng báo giá", key: "total", width: 16, number: true },
      { header: "Hiệu lực đến", value: (r) => formatDate(r.valid_until), width: 14 }, { header: "Trạng thái", key: "status", width: 14 }, { header: "Ghi chú", key: "notes", width: 34 },
    ],
  }]);

  return (
    <div className="stack">
      {quoteForEmail && (
        <EmailForm
          key={quoteForEmail.id}
          quote={quoteForEmail}
          initial={emailDefaults(quoteForEmail, company, draft?.quoteId === quoteForEmail.id ? draft.email : customerOf(quoteForEmail)?.email, draft?.quoteId === quoteForEmail.id ? draft.quoteRequestId : null)}
          onSent={() => { setEmailFor(null); list.reload(); }}
          onCancel={() => setEmailFor(null)}
        />
      )}
      <Panel title="Danh sách báo giá" subtitle={`${rows.length} / ${all.length} báo giá`} actions={<button type="button" className="btn btn-paper btn-small" onClick={exportQuotes}>Xuất Excel</button>}>
        <div className="filters">
          <SearchBox value={filters.query} onChange={(query) => setFilters({ ...filters, query })} placeholder="Tìm mã báo giá, khách hàng, nhân viên..." />
          <select aria-label="Trạng thái" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option value="">Tất cả trạng thái</option>{distinct(all, (q) => q.status).map((s) => <option key={s}>{s}</option>)}</select>
        </div>
        <LoadState resource={list} empty={list.data && !rows.length ? "Chưa có báo giá phù hợp." : ""}>
          <div className="table-wrap">
            <table className="ledger-table">
              <thead><tr><th>Mã</th><th>Khách hàng</th><th>Nhân viên</th><th className="num">Giá trị</th><th>Hiệu lực</th><th>Trạng thái</th><th>Xử lý</th></tr></thead>
              <tbody>
                {paged.visible.map((q) => (
                  <tr key={q.id}>
                    <td><strong>{q.id}</strong><span className="muted-line">{q.items.length} sản phẩm · {new Date(q.created_at).toLocaleDateString("vi-VN")}</span></td>
                    <td>{q.customer_name}</td>
                    <td>{q.employee_name || "—"}</td>
                    <td className="num">{money(q.total)}</td>
                    <td>{formatDate(q.valid_until) || "—"}</td>
                    <td>
                      {canManage ? (
                        <select aria-label={`Trạng thái ${q.id}`} value={q.status} onChange={(e) => changeStatus(q, e.target.value)}>{QUOTE_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
                      ) : <Badge>{q.status}</Badge>}
                    </td>
                    <td>
                      <span className="row-actions" style={{ justifyContent: "flex-start" }}>
                        <button type="button" className="btn btn-paper btn-small" onClick={() => downloadPdf(q)}>PDF</button>
                        {can("orders.create") && <button type="button" className="btn btn-paper btn-small" onClick={() => toOrder(q)}>Tạo đơn</button>}
                        {canManage && <button type="button" className="btn btn-paper btn-small" onClick={() => { setEmailFor(q.id); window.scrollTo({ top: 0 }); }}>Gửi mail</button>}
                      </span>
                    </td>
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

export function QuoteRequests() {
  const { user, can, run, notify, goTo, exportExcel, refreshAlerts } = useAdmin();
  const list = useApi("/quote-requests");
  const [filters, setFilters] = useState({ query: "", status: "" });
  const all = list.data || [];
  const rows = all.filter((r) => includesText(filters.query, r.customer_name, r.phone, r.email, r.product_name, r.company_name) && (!filters.status || r.status === filters.status));
  const paged = usePaged(rows, JSON.stringify(filters));
  const newCount = all.filter((r) => r.status === "Mới").length;

  async function changeStatus(row, status) {
    const ok = await run(() => request(`/quote-requests/${row.id}`, { method: "PATCH", body: { status, assignedEmployee: user.name } }), "Đã cập nhật yêu cầu báo giá");
    if (ok) {
      list.reload();
      refreshAlerts();
    }
  }

  // Links the request to a matching CRM customer by phone/email, or creates one. Returns { id, existing } or null.
  async function linkCustomer(row, { announce }) {
    let result = null;
    const ok = await run(async () => {
      result = await request(`/quote-requests/${row.id}/customer`, { method: "POST" });
    });
    if (!ok) return null;
    if (announce) notify("success", result.existing ? "Đã liên kết khách hàng có sẵn trong CRM" : "Đã tự động thêm khách hàng vào CRM");
    list.reload();
    return result;
  }

  async function createQuote(row) {
    let customerId = row.customer_id;
    if (!customerId) {
      const result = await linkCustomer(row, { announce: false });
      if (!result) return;
      customerId = result.id;
    }
    putDraft("quotation", {
      note: `Tạo từ yêu cầu website #${row.id} của ${row.customer_name}.`,
      form: { customerId: String(customerId), notes: row.message || "", quoteRequestId: row.id },
      lines: [{ productId: row.product_id ? String(row.product_id) : "", quantity: String(row.quantity || 1), unitPrice: "" }],
    });
    goTo("quotations_create");
  }

  function sendPdf(row) {
    putDraft("quoteEmail", { quoteId: row.quotation_id, email: row.email, quoteRequestId: row.id });
    goTo("quotations_list");
  }

  const exportRequests = () => exportExcel("yeu-cau-bao-gia.xlsx", [{
    name: "Yêu cầu báo giá", rows: all,
    columns: [
      { header: "Mã", key: "id", width: 8 }, { header: "Ngày gửi", value: (r) => excelDate(r.created_at), width: 22 }, { header: "Khách hàng", key: "customer_name", width: 24 },
      { header: "Công ty", key: "company_name", width: 24 }, { header: "Điện thoại", key: "phone", width: 16 }, { header: "Email", key: "email", width: 26 },
      { header: "Sản phẩm", key: "product_name", width: 24 }, { header: "Số lượng", key: "quantity", width: 10, number: true }, { header: "Nội dung", key: "message", width: 40 },
      { header: "Trạng thái", key: "status", width: 14 }, { header: "Nhân viên phụ trách", key: "assigned_employee", width: 20 }, { header: "Mã CRM", key: "customer_id", width: 10 },
      { header: "Mã báo giá", key: "quotation_id", width: 18 }, { header: "Ngày phản hồi", value: (r) => excelDate(r.responded_at), width: 22 },
    ],
  }]);

  return (
    <Panel
      title="Yêu cầu báo giá từ website"
      subtitle="Phân công và theo dõi quá trình tư vấn."
      actions={<><Badge tone={newCount ? "warn" : "ok"}>{newCount} mới</Badge><button type="button" className="btn btn-paper btn-small" onClick={exportRequests}>Xuất Excel</button></>}
    >
      <div className="filters">
        <SearchBox value={filters.query} onChange={(query) => setFilters({ ...filters, query })} placeholder="Tìm khách hàng, điện thoại, email, sản phẩm..." />
        <select aria-label="Trạng thái" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option value="">Tất cả trạng thái</option>{REQUEST_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
      </div>
      <LoadState resource={list} empty={list.data && !rows.length ? "Chưa có yêu cầu nào." : ""}>
        <div className="table-wrap">
          <table className="ledger-table">
            <thead><tr><th>Khách hàng</th><th>Liên hệ</th><th>Sản phẩm</th><th>CRM</th><th>Trạng thái</th><th>Xử lý</th></tr></thead>
            <tbody>
              {paged.visible.map((r) => (
                <tr key={r.id}>
                  <td><strong>{r.customer_name}</strong><span className="muted-line">{r.company_name || ""} · {new Date(r.created_at).toLocaleString("vi-VN")}</span></td>
                  <td>{r.phone}<span className="muted-line">{r.email || "Chưa có email"}</span></td>
                  <td>{r.product_name || "Chưa xác định"}<span className="muted-line">SL: {r.quantity} · {r.message || "Không ghi chú"}</span></td>
                  <td>
                    {r.customer_id ? <><Badge tone="ok">Đã liên kết</Badge><span className="muted-line">{r.crm_customer_name}</span></>
                      : r.customer_matches?.length ? <><Badge tone="warn">Tìm thấy {r.customer_matches.length}</Badge><span className="muted-line">{r.customer_matches.map((m) => m.name).join(", ")}</span></>
                        : <><Badge>Khách hàng mới</Badge><span className="muted-line">Chưa có trong CRM</span></>}
                  </td>
                  <td>
                    <select aria-label={`Trạng thái yêu cầu ${r.id}`} value={r.status} onChange={(e) => changeStatus(r, e.target.value)}>{REQUEST_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
                    <span className="muted-line">{r.assigned_employee || "Chưa phân công"}</span>
                  </td>
                  <td>
                    <span className="row-actions" style={{ justifyContent: "flex-start" }}>
                      {!r.customer_id && can("customers.manage") && (
                        <button type="button" className="btn btn-paper btn-small" onClick={() => linkCustomer(r, { announce: true })}>
                          {r.customer_matches?.length ? "Liên kết CRM" : "+ CRM"}
                        </button>
                      )}
                      {can("quotations.manage") && (r.customer_id || can("customers.manage")) && (
                        <button type="button" className="btn btn-door btn-small" onClick={() => createQuote(r)}>{r.quotation_id ? "Tạo báo giá khác" : "Tạo báo giá"}</button>
                      )}
                      {r.quotation_id && r.email && can("quotations.manage") && <button type="button" className="btn btn-paper btn-small" onClick={() => sendPdf(r)}>Gửi PDF</button>}
                    </span>
                    {r.responded_at && <span className="muted-line">Đã gửi: {new Date(r.responded_at).toLocaleString("vi-VN")}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination paged={paged} />
      </LoadState>
    </Panel>
  );
}
