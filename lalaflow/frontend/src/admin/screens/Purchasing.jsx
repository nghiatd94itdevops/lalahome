import { useState } from "react";
import { formatDate, money } from "../../api.js";
import { request, useApi } from "../client.js";
import { ActiveBadge, Badge, Field, LoadState, MoneyInput, Panel, useAdmin } from "../ui.jsx";

const EMPTY_SUPPLIER = { name: "", contactName: "", phone: "", email: "", taxCode: "", paymentTermDays: "0", address: "", notes: "", active: true };
const supplierToForm = (s) => ({
  id: s.id, name: s.name || "", contactName: s.contact_name || "", phone: s.phone || "", email: s.email || "", taxCode: s.tax_code || "",
  paymentTermDays: String(s.payment_term_days ?? 0), address: s.address || "", notes: s.notes || "", active: Boolean(s.active),
});

export function Suppliers() {
  const { can, run, notify } = useAdmin();
  const list = useApi("/suppliers");
  const [form, setForm] = useState(EMPTY_SUPPLIER);
  const canManage = can("suppliers.manage");
  const editing = Boolean(form.id);
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  async function submit(event) {
    event.preventDefault();
    if (!form.name.trim()) return notify("error", "Vui lòng nhập tên nhà cung cấp.");
    const days = Number(form.paymentTermDays || 0);
    if (!Number.isInteger(days) || days < 0) return notify("error", "Số ngày thanh toán phải là số nguyên không âm.");
    const body = { ...form, name: form.name.trim(), paymentTermDays: days };
    const ok = await run(
      () => request(editing ? `/suppliers/${form.id}` : "/suppliers", { method: editing ? "PUT" : "POST", body }),
      editing ? "Đã cập nhật nhà cung cấp" : "Đã thêm nhà cung cấp",
    );
    if (ok) {
      setForm(EMPTY_SUPPLIER);
      list.reload();
    }
  }

  return (
    <div className="stack">
      {canManage && (
        <Panel title={editing ? "Cập nhật nhà cung cấp" : "Thêm nhà cung cấp"} subtitle="Quản lý pháp lý, đầu mối liên hệ và điều khoản thanh toán.">
          <form onSubmit={submit} className="stack">
            <div className="form-grid form-grid-3">
              <Field label="Tên nhà cung cấp *"><input id="supplier-name" value={form.name} onChange={set("name")} required /></Field>
              <Field label="Người liên hệ"><input id="supplier-contact" value={form.contactName} onChange={set("contactName")} /></Field>
              <Field label="Điện thoại"><input id="supplier-phone" type="tel" value={form.phone} onChange={set("phone")} /></Field>
              <Field label="Email"><input id="supplier-email" type="email" value={form.email} onChange={set("email")} /></Field>
              <Field label="Mã số thuế"><input id="supplier-tax" value={form.taxCode} onChange={set("taxCode")} /></Field>
              <Field label="Số ngày thanh toán"><input id="supplier-term" type="number" min="0" value={form.paymentTermDays} onChange={set("paymentTermDays")} /></Field>
              <Field label="Địa chỉ" wide><textarea id="supplier-address" rows="2" value={form.address} onChange={set("address")} /></Field>
              <Field label="Ghi chú" wide><textarea id="supplier-notes" rows="2" value={form.notes} onChange={set("notes")} /></Field>
            </div>
            <label className="check"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Đang active</label>
            <div className="form-actions">
              <button type="submit" className="btn btn-door">{editing ? "Lưu nhà cung cấp" : "Thêm nhà cung cấp"}</button>
              {editing && <button type="button" className="btn btn-paper" onClick={() => setForm(EMPTY_SUPPLIER)}>Hủy</button>}
            </div>
          </form>
        </Panel>
      )}
      <Panel title="Danh sách nhà cung cấp" subtitle={`${list.data?.length || 0} nhà cung cấp`}>
        <LoadState resource={list} empty={list.data && !list.data.length ? "Chưa có nhà cung cấp." : ""}>
          <div className="table-wrap">
            <table className="ledger-table">
              <thead><tr><th>Nhà cung cấp</th><th>Liên hệ</th><th>Mã số thuế</th><th>Điều khoản</th><th className="num">Đơn mua</th><th className="num">Tổng mua</th><th /></tr></thead>
              <tbody>
                {(list.data || []).map((s) => (
                  <tr key={s.id} className={s.active ? "" : "is-off"}>
                    <td><strong>{s.name}</strong> <ActiveBadge active={s.active} /></td>
                    <td>{s.contact_name || "—"}<span className="muted-line">{[s.phone, s.email].filter(Boolean).join(" · ") || "Chưa có"}</span></td>
                    <td>{s.tax_code || "—"}</td>
                    <td>{s.payment_term_days} ngày</td>
                    <td className="num">{s.purchase_order_count}</td>
                    <td className="num">{money(s.purchase_total)}</td>
                    <td>{canManage && <button type="button" className="btn btn-paper btn-small" onClick={() => setForm(supplierToForm(s))}>Sửa</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </LoadState>
      </Panel>
    </div>
  );
}

const emptyLine = () => ({ productId: "", quantity: "1", unitCost: "" });

export function PurchaseCreate() {
  const { user, run, notify, goTo } = useAdmin();
  const suppliers = useApi("/suppliers");
  const products = useApi("/products?all=1");
  const [form, setForm] = useState({ supplierId: "", employeeName: user.name || "", expectedDate: "", notes: "" });
  const [lines, setLines] = useState([emptyLine()]);
  const activeSuppliers = (suppliers.data || []).filter((s) => s.active);
  const activeProducts = (products.data || []).filter((p) => p.active);
  const total = lines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unitCost || 0), 0);

  const setLine = (index, patch) => setLines(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  const chooseProduct = (index, productId) => {
    const product = activeProducts.find((p) => String(p.id) === productId);
    setLine(index, { productId, unitCost: product ? String(product.cost_price || 0) : "" });
  };

  async function submit(event) {
    event.preventDefault();
    if (!form.supplierId) return notify("error", "Vui lòng chọn nhà cung cấp.");
    const items = lines.filter((line) => line.productId).map((line) => ({ productId: Number(line.productId), quantity: Number(line.quantity), unitCost: Number(line.unitCost || 0) }));
    if (!items.length) return notify("error", "Đơn mua phải có ít nhất một sản phẩm.");
    if (items.some((item) => !Number.isInteger(item.quantity) || item.quantity < 1)) return notify("error", "Số lượng mua phải là số nguyên lớn hơn 0.");
    const ok = await run(() => request("/purchase-orders", { method: "POST", body: { ...form, supplierId: Number(form.supplierId), items } }), "Đã tạo đơn mua hàng");
    if (ok) goTo("purchases_list");
  }

  return (
    <Panel title="Tạo đơn mua hàng" subtitle="Đơn mua chỉ tăng tồn khi chuyển trạng thái sang “Đã nhập kho”.">
      <LoadState resource={suppliers.status === "ready" ? products : suppliers}>
        <form onSubmit={submit} className="stack">
          <div className="form-grid form-grid-3">
            <Field label="Nhà cung cấp *">
              <select id="po-supplier" value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })} required>
                <option value="">Chọn nhà cung cấp</option>
                {activeSuppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="Nhân viên phụ trách"><input id="po-employee" value={form.employeeName} onChange={(e) => setForm({ ...form, employeeName: e.target.value })} /></Field>
            <Field label="Ngày dự kiến nhận"><input id="po-date" type="date" value={form.expectedDate} onChange={(e) => setForm({ ...form, expectedDate: e.target.value })} /></Field>
          </div>
          <fieldset className="subgroup">
            <legend>Sản phẩm mua</legend>
            <div className="line-items">
              {lines.map((line, index) => (
                <div className="line-item" key={index}>
                  <select aria-label="Sản phẩm" value={line.productId} onChange={(e) => chooseProduct(index, e.target.value)}>
                    <option value="">Chọn sản phẩm</option>
                    {activeProducts.map((p) => <option key={p.id} value={p.id}>{p.name} — tồn {p.stock}</option>)}
                  </select>
                  <input aria-label="Số lượng" type="number" min="1" value={line.quantity} onChange={(e) => setLine(index, { quantity: e.target.value })} />
                  <MoneyInput aria-label="Đơn giá mua" placeholder="Đơn giá" value={line.unitCost} onChange={(value) => setLine(index, { unitCost: value })} />
                  <span className="line-total">{money(Number(line.quantity || 0) * Number(line.unitCost || 0))}</span>
                  <button type="button" className="icon-button" aria-label="Xóa dòng" onClick={() => setLines(lines.length > 1 ? lines.filter((_, i) => i !== index) : [emptyLine()])}>×</button>
                </div>
              ))}
            </div>
            <button type="button" className="btn btn-paper btn-small" onClick={() => setLines([...lines, emptyLine()])}>+ Thêm sản phẩm</button>
          </fieldset>
          <Field label="Ghi chú / điều khoản" wide><textarea id="po-notes" rows="3" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          <div className="total-bar"><span>Tổng tiền mua</span><strong>{money(total)}</strong></div>
          <div className="form-actions"><button type="submit" className="btn btn-door">Tạo đơn mua</button></div>
        </form>
      </LoadState>
    </Panel>
  );
}

const PO_STATUSES = ["Nháp", "Đã duyệt", "Đã nhập kho", "Đã hủy"];
const PO_TONE = { "Nháp": "neutral", "Đã duyệt": "warn", "Đã nhập kho": "ok", "Đã hủy": "bad" };
const RECEIVED = "Đã nhập kho";

export function PurchaseList() {
  const { can, run, confirm } = useAdmin();
  const list = useApi("/purchase-orders");
  const canManage = can("purchases.manage");

  async function changeStatus(order, status) {
    if (status === RECEIVED && !(await confirm({
      title: "Nhập hàng vào kho?",
      message: `Tồn kho các sản phẩm trong đơn ${order.id} sẽ tăng và giá vốn được cập nhật theo đơn giá mua. Sau bước này không đổi trạng thái được nữa.`,
      confirmLabel: "Nhập kho",
    }))) return;
    const ok = await run(() => request(`/purchase-orders/${order.id}/status`, { method: "PATCH", body: { status } }),
      status === RECEIVED ? "Đã nhập hàng vào kho và cập nhật giá vốn" : "Đã cập nhật trạng thái đơn mua");
    list.reload();
    return ok;
  }

  return (
    <Panel title="Danh sách đơn mua hàng" subtitle="Chuyển “Đã nhập kho” sẽ tăng tồn và cập nhật giá vốn.">
      <LoadState resource={list} empty={list.data && !list.data.length ? "Chưa có đơn mua." : ""}>
        <div className="table-wrap">
          <table className="ledger-table">
            <thead><tr><th>Mã</th><th>Nhà cung cấp</th><th>Nhân viên</th><th>Sản phẩm</th><th className="num">Tổng tiền</th><th>Dự kiến</th><th>Trạng thái</th></tr></thead>
            <tbody>
              {(list.data || []).map((order) => {
                const locked = order.status === RECEIVED;
                return (
                  <tr key={order.id}>
                    <td><strong>{order.id}</strong><span className="muted-line">{formatDate(order.created_at)}</span></td>
                    <td>{order.supplier_name}</td>
                    <td>{order.employee_name || "—"}</td>
                    <td>{order.items.map((item) => `${item.product_name} ×${item.quantity}`).join("; ")}</td>
                    <td className="num">{money(order.total)}</td>
                    <td>{formatDate(order.expected_date) || "—"}</td>
                    <td>
                      {canManage && !locked ? (
                        <select aria-label={`Trạng thái ${order.id}`} value={order.status} onChange={(e) => changeStatus(order, e.target.value)}>
                          {PO_STATUSES.map((status) => <option key={status}>{status}</option>)}
                        </select>
                      ) : (
                        <Badge tone={PO_TONE[order.status]}>{order.status}</Badge>
                      )}
                      {locked && order.received_at && <span className="muted-line">Nhập: {new Date(order.received_at).toLocaleString("vi-VN")}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </LoadState>
    </Panel>
  );
}
