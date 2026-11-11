import { useState } from "react";
import { request, useApi } from "../client.js";
import { excelDate } from "../excel.js";
import { ActiveBadge, Badge, Field, LoadState, Pagination, Panel, SearchBox, distinct, includesText, useAdmin, usePaged } from "../ui.jsx";

export const PERMISSION_TREE = [
  { group: "Nội dung website", items: [["content.manage", "Sửa thông tin công ty"], ["content.activities_create", "Tạo hoạt động"], ["content.activities_edit", "Sửa hoạt động"], ["content.activities_status", "Đổi active / inactive hoạt động"]] },
  { group: "Sản phẩm", items: [["products.create", "Tạo sản phẩm"], ["products.edit", "Sửa sản phẩm và hình ảnh"], ["products.change_status", "Đổi active / inactive sản phẩm"], ["products.categories_create", "Tạo loại sản phẩm"], ["products.categories_edit", "Sửa loại sản phẩm"], ["products.categories_status", "Đổi active / inactive loại"]] },
  { group: "Kho hàng", items: [["inventory.view", "Xem tồn kho và lịch sử"], ["inventory.transactions", "Ghi nhận nhập / xuất kho"]] },
  { group: "Bán hàng", items: [["orders.view", "Xem đơn hàng"], ["orders.create", "Tạo đơn hàng"], ["orders.change_status", "Cập nhật trạng thái đơn"], ["orders.payments", "Ghi nhận thanh toán"], ["orders.discounts_manage", "Quản lý mã chiết khấu"], ["customers.view", "Xem khách hàng CRM"], ["customers.manage", "Tạo và cập nhật khách hàng"], ["quotations.view", "Xem báo giá"], ["quotations.manage", "Tạo và cập nhật báo giá"], ["quote_requests.manage", "Xử lý yêu cầu báo giá"]] },
  { group: "Báo cáo", items: [["reports.view", "Xem báo cáo doanh thu, công nợ"]] },
  { group: "Mua hàng & nhà cung cấp", items: [["suppliers.view", "Xem nhà cung cấp"], ["suppliers.manage", "Tạo và cập nhật nhà cung cấp"], ["purchases.view", "Xem đơn mua hàng"], ["purchases.manage", "Tạo, duyệt và nhập kho đơn mua"]] },
];
const ALL_KEYS = PERMISSION_TREE.flatMap((g) => g.items.map(([key]) => key));
const ROLES = [["staff", "Tùy chỉnh"], ["sales", "Nhân viên sale"], ["warehouse", "Nhân viên kho"], ["accounting", "Kế toán"], ["content", "Quản lý nội dung"], ["admin", "Quản trị viên"]];
const ROLE_LABEL = Object.fromEntries(ROLES);
const permissionCount = (permissions) => (permissions?.includes("*") ? "Toàn quyền" : `${permissions?.length || 0} quyền`);

function PermissionTree({ value, onChange, readOnly }) {
  const toggle = (key) => onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key]);
  const toggleGroup = (keys) => {
    const allOn = keys.every((key) => value.includes(key));
    onChange(allOn ? value.filter((key) => !keys.includes(key)) : [...new Set([...value, ...keys])]);
  };
  return (
    <div className="permission-tree">
      {PERMISSION_TREE.map(({ group, items }) => {
        const keys = items.map(([key]) => key);
        return (
          <fieldset key={group} className="subgroup">
            <legend>
              {group}
              {!readOnly && <button type="button" className="link-button" onClick={() => toggleGroup(keys)}>{keys.every((key) => value.includes(key)) ? "Bỏ chọn" : "Chọn hết"}</button>}
            </legend>
            {items.map(([key, label]) => (
              <label key={key} className="check">
                <input type="checkbox" checked={value.includes(key)} disabled={readOnly} onChange={() => toggle(key)} />
                {label} <code>{key}</code>
              </label>
            ))}
          </fieldset>
        );
      })}
    </div>
  );
}

const EMPTY_EMPLOYEE = { name: "", email: "", phone: "", password: "", role: "staff", groupId: "", active: true };
const employeeToForm = (u) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone || "", password: "", role: u.role, groupId: u.groupId ? String(u.groupId) : "", active: u.active });

export function Employees() {
  const { user, run, notify } = useAdmin();
  const list = useApi("/employees");
  const groups = useApi("/permission-groups");
  const [form, setForm] = useState(EMPTY_EMPLOYEE);
  const editing = Boolean(form.id);
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });
  const groupList = groups.data || [];
  const chosenGroup = groupList.find((g) => String(g.id) === form.groupId);
  const assignable = groupList.filter((g) => g.active && (!g.is_system || form.role === "admin"));

  async function submit(event) {
    event.preventDefault();
    if (!form.name.trim() || !form.email.trim()) return notify("error", "Vui lòng nhập họ tên và email đăng nhập.");
    if (!editing && form.password.length < 6) return notify("error", "Mật khẩu cần ít nhất 6 ký tự.");
    if (editing && form.password && form.password.length < 6) return notify("error", "Mật khẩu mới cần ít nhất 6 ký tự.");
    if (editing && form.id === user.id && !form.active) return notify("error", "Không thể tự khóa tài khoản đang đăng nhập.");
    const body = { ...form, name: form.name.trim(), email: form.email.trim().toLowerCase(), groupId: form.groupId ? Number(form.groupId) : null };
    if (editing && !form.password) delete body.password;
    const ok = await run(() => request(editing ? `/employees/${form.id}` : "/employees", { method: editing ? "PUT" : "POST", body }),
      editing ? "Đã cập nhật nhân viên. Nhân viên cần đăng nhập lại để nhận quyền mới." : "Đã tạo tài khoản nhân viên");
    if (ok) {
      setForm(EMPTY_EMPLOYEE);
      list.reload();
    }
  }

  return (
    <div className="stack">
      <Panel title={editing ? "Cập nhật nhân viên" : "Thêm nhân viên mới"} subtitle="Quyền thực tế của nhân viên lấy từ nhóm quyền được gán.">
        <form onSubmit={submit} className="stack">
          <div className="form-grid form-grid-3">
            <Field label="Họ và tên *"><input id="emp-name" value={form.name} onChange={set("name")} required /></Field>
            <Field label="Email đăng nhập *"><input id="emp-email" type="email" autoComplete="off" value={form.email} onChange={set("email")} required /></Field>
            <Field label="Số điện thoại"><input id="emp-phone" type="tel" value={form.phone} onChange={set("phone")} /></Field>
            <Field label={editing ? "Mật khẩu mới (để trống nếu giữ nguyên)" : "Mật khẩu *"} hint="Ít nhất 6 ký tự">
              <input id="emp-password" type="password" autoComplete="new-password" value={form.password} onChange={set("password")} minLength={6} required={!editing} />
            </Field>
            <Field label="Vai trò" hint={!editing && !form.groupId ? "Nếu không chọn nhóm, hệ thống gán nhóm mặc định theo vai trò." : undefined}>
              <select id="emp-role" value={form.role} onChange={set("role")}>{ROLES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
            </Field>
            <Field label="Nhóm quyền">
              <select id="emp-group" value={form.groupId} onChange={set("groupId")}>
                <option value="">{editing ? "Chưa thuộc nhóm" : "Theo vai trò"}</option>
                {assignable.map((g) => <option key={g.id} value={g.id}>{g.name} ({permissionCount(g.permissions)})</option>)}
              </select>
            </Field>
          </div>
          <label className="check"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Tài khoản đang hoạt động</label>
          {form.role === "admin" ? <p className="load-note">Quản trị viên có toàn quyền hệ thống.</p> : chosenGroup && <PermissionTree value={chosenGroup.permissions} readOnly onChange={() => {}} />}
          <div className="form-actions">
            <button type="submit" className="btn btn-door">{editing ? "Lưu thay đổi" : "Tạo nhân viên"}</button>
            {editing && <button type="button" className="btn btn-paper" onClick={() => setForm(EMPTY_EMPLOYEE)}>Hủy</button>}
          </div>
        </form>
      </Panel>
      <Panel title="Danh sách nhân viên" subtitle="Tài khoản bị khóa sẽ không thể đăng nhập.">
        <LoadState resource={list}>
          <ul className="card-list">
            {(list.data || []).map((u) => (
              <li key={u.id} className={u.active ? "" : "is-off"}>
                <span className="thumb">{(u.name || "?").charAt(0).toUpperCase()}</span>
                <span className="card-text"><strong>{u.name}{u.id === user.id ? " (bạn)" : ""}</strong>{u.email} · {u.phone || "Chưa có SĐT"} · {ROLE_LABEL[u.role] || u.role} · {u.groupName || "Chưa thuộc nhóm"} · {permissionCount(u.permissions)}</span>
                <Badge tone={u.active ? "ok" : "bad"}>{u.active ? "Hoạt động" : "Đã khóa"}</Badge>
                <span className="row-actions"><button type="button" className="btn btn-paper btn-small" onClick={() => { setForm(employeeToForm(u)); window.scrollTo({ top: 0 }); }}>Sửa</button></span>
              </li>
            ))}
          </ul>
        </LoadState>
      </Panel>
    </div>
  );
}

export function EmployeeGroups() {
  const { run } = useAdmin();
  const list = useApi("/employees");
  const groups = useApi("/permission-groups");
  const staff = (list.data || []).filter((u) => u.role !== "admin");
  const assignable = (groups.data || []).filter((g) => g.active && !g.is_system);

  async function assign(employee, groupId) {
    const ok = await run(() => request(`/employees/${employee.id}/group`, { method: "PATCH", body: { groupId: Number(groupId) } }), "Đã chuyển nhóm cho nhân viên. Nhân viên cần đăng nhập lại.");
    if (ok) list.reload();
  }

  return (
    <Panel title="Gán nhân viên vào nhóm" subtitle="Quyền thực tế của nhân viên được kế thừa hoàn toàn từ nhóm đã chọn.">
      <LoadState resource={list.status === "ready" ? groups : list} empty={list.data && !staff.length ? "Chưa có nhân viên ngoài quản trị viên." : ""}>
        <div className="table-wrap">
          <table className="ledger-table">
            <thead><tr><th>Nhân viên</th><th>Trạng thái</th><th>Nhóm quyền</th></tr></thead>
            <tbody>
              {staff.map((u) => (
                <tr key={u.id}>
                  <td><strong>{u.name}</strong><span className="muted-line">{u.email}</span></td>
                  <td><Badge tone={u.active ? "ok" : "bad"}>{u.active ? "Hoạt động" : "Đã khóa"}</Badge></td>
                  <td>
                    <select aria-label={`Nhóm của ${u.name}`} value={u.groupId || ""} onChange={(e) => assign(u, e.target.value)}>
                      <option value="" disabled>Chưa thuộc nhóm</option>
                      {assignable.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </LoadState>
    </Panel>
  );
}

const EMPTY_GROUP = { name: "", description: "", permissions: [], active: true };

export function Groups() {
  const { run, notify } = useAdmin();
  const list = useApi("/permission-groups");
  const [form, setForm] = useState(EMPTY_GROUP);
  const editing = Boolean(form.id);

  async function submit(event) {
    event.preventDefault();
    if (!form.name.trim()) return notify("error", "Tên nhóm là bắt buộc.");
    const body = { name: form.name.trim(), description: form.description, permissions: form.permissions.filter((key) => ALL_KEYS.includes(key)), active: form.active };
    const ok = await run(() => request(editing ? `/permission-groups/${form.id}` : "/permission-groups", { method: editing ? "PUT" : "POST", body }), editing ? "Đã cập nhật nhóm quyền" : "Đã tạo nhóm quyền");
    if (ok) {
      setForm(EMPTY_GROUP);
      list.reload();
    }
  }

  return (
    <div className="stack">
      <Panel title={editing ? "Sửa nhóm quyền" : "Tạo nhóm quyền mới"} subtitle="Nhân viên trong nhóm chỉ nhận các quyền được chọn tại đây." actions={<Badge>{form.permissions.length} quyền</Badge>}>
        <form onSubmit={submit} className="stack">
          <div className="form-grid">
            <Field label="Tên nhóm *"><input id="group-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
            <Field label="Mô tả nhóm"><input id="group-description" value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          </div>
          <label className="check"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Nhóm đang active</label>
          <PermissionTree value={form.permissions} onChange={(permissions) => setForm({ ...form, permissions })} />
          <div className="form-actions">
            <button type="submit" className="btn btn-door">{editing ? "Lưu nhóm quyền" : "Tạo nhóm"}</button>
            {editing && <button type="button" className="btn btn-paper" onClick={() => setForm(EMPTY_GROUP)}>Hủy</button>}
          </div>
        </form>
      </Panel>
      <Panel title="Danh sách nhóm" subtitle="Administrator là nhóm hệ thống, không thể sửa hoặc inactive.">
        <LoadState resource={list}>
          <ul className="card-list">
            {(list.data || []).map((g) => (
              <li key={g.id} className={g.active ? "" : "is-off"}>
                <span className="thumb">{g.is_system ? "★" : "⚑"}</span>
                <span className="card-text"><strong>{g.name}</strong>{g.description || "Chưa có mô tả"} · {g.member_count} nhân viên · {permissionCount(g.permissions)}</span>
                <ActiveBadge active={g.active} />
                <span className="row-actions">
                  {!g.is_system && <button type="button" className="btn btn-paper btn-small" onClick={() => { setForm({ id: g.id, name: g.name, description: g.description || "", permissions: g.permissions, active: g.active }); window.scrollTo({ top: 0 }); }}>Sửa nhóm & quyền</button>}
                </span>
              </li>
            ))}
          </ul>
        </LoadState>
      </Panel>
    </div>
  );
}

const ACTION_LABEL = { CREATE: "Tạo mới", UPDATE: "Cập nhật", STATUS: "Đổi trạng thái", PAYMENT: "Thanh toán", UPLOAD: "Tải ảnh", SEND_EMAIL: "Gửi email" };

export function AuditLogs() {
  const { exportExcel } = useAdmin();
  const list = useApi("/audit-logs");
  const [filters, setFilters] = useState({ query: "", action: "", entity: "" });
  const all = list.data || [];
  const rows = all.filter((l) => includesText(filters.query, l.user_email, l.entity_type, l.entity_id, l.details) && (!filters.action || l.action === filters.action) && (!filters.entity || l.entity_type === filters.entity));
  const paged = usePaged(rows, JSON.stringify(filters), 20);

  const exportLogs = () => exportExcel("nhat-ky-hoat-dong.xlsx", [{
    name: "Nhật ký", rows: all,
    columns: [
      { header: "Mã", key: "id", width: 8 }, { header: "Thời gian", value: (r) => excelDate(r.created_at), width: 22 }, { header: "Người thao tác", key: "user_email", width: 26 },
      { header: "Hành động", key: "action", width: 14 }, { header: "Loại dữ liệu", key: "entity_type", width: 20 }, { header: "Mã dữ liệu", key: "entity_id", width: 18 }, { header: "Chi tiết", key: "details", width: 50 },
    ],
  }]);

  return (
    <Panel title="Nhật ký hoạt động" subtitle="300 thao tác tạo / sửa gần nhất trên hệ thống." actions={<button type="button" className="btn btn-paper btn-small" onClick={exportLogs}>Xuất Excel</button>}>
      <div className="filters">
        <SearchBox value={filters.query} onChange={(query) => setFilters({ ...filters, query })} placeholder="Tìm người thao tác, dữ liệu, chi tiết..." />
        <select aria-label="Hành động" value={filters.action} onChange={(e) => setFilters({ ...filters, action: e.target.value })}><option value="">Tất cả hành động</option>{distinct(all, (l) => l.action).map((a) => <option key={a} value={a}>{ACTION_LABEL[a] || a}</option>)}</select>
        <select aria-label="Loại dữ liệu" value={filters.entity} onChange={(e) => setFilters({ ...filters, entity: e.target.value })}><option value="">Tất cả loại dữ liệu</option>{distinct(all, (l) => l.entity_type).map((t) => <option key={t}>{t}</option>)}</select>
      </div>
      <LoadState resource={list} empty={list.data && !rows.length ? "Chưa có thao tác nào được ghi." : ""}>
        <div className="table-wrap">
          <table className="ledger-table">
            <thead><tr><th>Thời gian</th><th>Nhân viên</th><th>Hành động</th><th>Dữ liệu</th><th>Chi tiết</th></tr></thead>
            <tbody>
              {paged.visible.map((l) => (
                <tr key={l.id}>
                  <td>{new Date(l.created_at).toLocaleString("vi-VN")}</td>
                  <td>{l.user_email || "Hệ thống"}</td>
                  <td><Badge>{ACTION_LABEL[l.action] || l.action}</Badge></td>
                  <td>{l.entity_type}{l.entity_id ? ` #${l.entity_id}` : ""}</td>
                  <td>{l.details || "—"}</td>
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
