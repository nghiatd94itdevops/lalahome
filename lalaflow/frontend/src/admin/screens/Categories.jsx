import { useState } from "react";
import { request, useApi } from "../client.js";
import { ActiveBadge, Field, LoadState, Panel, useAdmin } from "../ui.jsx";

const EMPTY = { name: "", description: "" };

function CategoryForm({ initial, onSaved, onCancel }) {
  const { run, notify } = useAdmin();
  const [form, setForm] = useState(initial);
  const editing = Boolean(initial.id);

  async function submit(event) {
    event.preventDefault();
    const body = { name: form.name.trim(), description: form.description?.trim() || "" };
    if (!body.name) return notify("error", "Tên loại sản phẩm là bắt buộc.");
    const ok = await run(
      () => request(editing ? `/categories/${form.id}` : "/categories", { method: editing ? "PUT" : "POST", body }),
      editing ? "Đã cập nhật loại sản phẩm" : "Đã thêm loại sản phẩm",
    );
    if (ok) onSaved();
  }

  return (
    <Panel title={editing ? "Sửa loại sản phẩm" : "Thêm loại sản phẩm"} subtitle="Loại sản phẩm được dùng trong form sản phẩm và bộ lọc ngoài website.">
      <form onSubmit={submit} className="stack">
        <div className="form-grid">
          <Field label="Tên loại sản phẩm *" hint={editing ? "Đổi tên sẽ cập nhật luôn các sản phẩm thuộc loại này." : undefined}>
            <input id="category-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </Field>
          <Field label="Mô tả"><input id="category-description" value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn-door">{editing ? "Cập nhật" : "Thêm loại"}</button>
          {onCancel && <button type="button" className="btn btn-paper" onClick={onCancel}>Hủy</button>}
        </div>
      </form>
    </Panel>
  );
}

export function CategoriesCreate() {
  const [round, setRound] = useState(0);
  return <CategoryForm key={round} initial={EMPTY} onSaved={() => setRound(round + 1)} />;
}

export function CategoriesList() {
  const { can, run, confirm } = useAdmin();
  const list = useApi("/categories?all=1");
  const [editing, setEditing] = useState(null);
  const rows = list.data || [];

  async function toggle(row) {
    const next = !row.active;
    if (!next) {
      const warning = row.product_count ? ` Loại này còn ${row.product_count} sản phẩm, các sản phẩm vẫn giữ nguyên.` : "";
      if (!(await confirm({ title: "Ngừng dùng loại sản phẩm?", message: `"${row.name}" sẽ không còn chọn được khi thêm sản phẩm.${warning}`, confirmLabel: "Chuyển inactive" }))) return;
    }
    const ok = await run(() => request(`/categories/${row.id}/status`, { method: "PATCH", body: { active: next } }), next ? "Đã kích hoạt loại sản phẩm" : "Đã chuyển loại sang inactive");
    if (ok) list.reload();
  }

  return (
    <div className="stack">
      {editing && <CategoryForm key={editing.id} initial={editing} onSaved={() => { setEditing(null); list.reload(); }} onCancel={() => setEditing(null)} />}
      <Panel title="Danh sách loại sản phẩm" subtitle={`${rows.length} loại`}>
        <LoadState resource={list} empty={list.data && !rows.length ? "Chưa có loại sản phẩm." : ""}>
          <ul className="card-list">
            {rows.map((row) => (
              <li key={row.id} className={row.active ? "" : "is-off"}>
                <span className="thumb">▤</span>
                <span className="card-text"><strong>{row.name}</strong>{row.description || "Chưa có mô tả"} · {row.product_count} sản phẩm</span>
                <ActiveBadge active={row.active} />
                <span className="row-actions">
                  {can("products.categories_edit") && <button type="button" className="btn btn-paper btn-small" onClick={() => setEditing(row)}>Sửa</button>}
                  {can("products.categories_status") && <button type="button" className="btn btn-paper btn-small" onClick={() => toggle(row)}>{row.active ? "Ngừng dùng" : "Dùng lại"}</button>}
                </span>
              </li>
            ))}
          </ul>
        </LoadState>
      </Panel>
    </div>
  );
}
