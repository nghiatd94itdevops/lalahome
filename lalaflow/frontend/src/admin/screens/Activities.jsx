import { useState } from "react";
import { formatDate, imageUrl } from "../../api.js";
import { request, useApi } from "../client.js";
import { ActiveBadge, Field, LoadState, Pagination, Panel, SearchBox, includesText, useAdmin, usePaged } from "../ui.jsx";

const today = () => new Date().toISOString().slice(0, 10);
const emptyActivity = () => ({ title: "", date: today(), category: "Doanh nghiệp", image: "", summary: "" });
const toForm = (activity) => ({ ...emptyActivity(), ...activity, date: String(activity.date || "").slice(0, 10), image: activity.image || "" });

function ActivityForm({ initial, onSaved, onCancel }) {
  const { run, notify } = useAdmin();
  const [form, setForm] = useState(initial);
  const editing = Boolean(initial.id);
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  async function submit(event) {
    event.preventDefault();
    const body = { title: form.title.trim(), date: form.date, category: form.category.trim(), image: form.image.trim(), summary: form.summary };
    if (!body.title || !body.date || !body.category) return notify("error", "Vui lòng nhập tiêu đề, ngày đăng và chuyên mục.");
    const ok = await run(
      () => request(editing ? `/activities/${form.id}` : "/activities", { method: editing ? "PUT" : "POST", body }),
      editing ? "Đã cập nhật hoạt động" : "Đã đăng hoạt động mới",
    );
    if (ok) onSaved();
  }

  return (
    <Panel title={editing ? "Sửa hoạt động" : "Đăng hoạt động mới"} subtitle="Tin sẽ xuất hiện ở trang chủ và trang hoạt động.">
      <form onSubmit={submit} className="stack">
        <div className="form-grid">
          <Field label="Tiêu đề *"><input id="activity-title" value={form.title} onChange={set("title")} required /></Field>
          <Field label="Ngày đăng *"><input id="activity-date" type="date" value={form.date} onChange={set("date")} required /></Field>
          <Field label="Chuyên mục *"><input id="activity-category" value={form.category} onChange={set("category")} required /></Field>
          <Field label="Link ảnh" hint="Đường dẫn http(s) hoặc /uploads/…"><input id="activity-image" value={form.image} onChange={set("image")} /></Field>
          <Field label="Tóm tắt" wide><textarea id="activity-summary" rows="4" value={form.summary} onChange={set("summary")} /></Field>
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn-door">{editing ? "Cập nhật hoạt động" : "Đăng hoạt động"}</button>
          {onCancel && <button type="button" className="btn btn-paper" onClick={onCancel}>Hủy</button>}
        </div>
      </form>
    </Panel>
  );
}

export function ActivitiesCreate() {
  const [round, setRound] = useState(0);
  return <ActivityForm key={round} initial={emptyActivity()} onSaved={() => setRound(round + 1)} />;
}

export function ActivitiesList() {
  const { can, run, confirm } = useAdmin();
  const list = useApi("/activities?all=1");
  const [editing, setEditing] = useState(null);
  const [query, setQuery] = useState("");
  const rows = (list.data || []).filter((row) => includesText(query, row.title, row.category, row.summary));
  const paged = usePaged(rows, query);

  async function toggle(row) {
    const next = !row.active;
    if (!next && !(await confirm({ title: "Ẩn hoạt động?", message: `"${row.title}" sẽ không còn hiện trên website.`, confirmLabel: "Ẩn hoạt động" }))) return;
    const ok = await run(() => request(`/activities/${row.id}/status`, { method: "PATCH", body: { active: next } }), next ? "Đã kích hoạt hoạt động" : "Đã chuyển hoạt động sang inactive");
    if (ok) list.reload();
  }

  return (
    <div className="stack">
      {editing && <ActivityForm key={editing.id} initial={toForm(editing)} onSaved={() => { setEditing(null); list.reload(); }} onCancel={() => setEditing(null)} />}
      <Panel title="Danh sách hoạt động" subtitle={`${rows.length} hoạt động`}>
        <div className="filters"><SearchBox value={query} onChange={setQuery} placeholder="Tìm tiêu đề, chuyên mục..." /></div>
        <LoadState resource={list} empty={list.data && !rows.length ? "Chưa có hoạt động phù hợp." : ""}>
          <ul className="card-list">
            {paged.visible.map((row) => (
              <li key={row.id} className={row.active ? "" : "is-off"}>
                <span className="thumb">{row.image ? <img src={imageUrl(row.image)} alt="" /> : "✿"}</span>
                <span className="card-text"><strong>{row.title}</strong>{row.category} · {formatDate(row.date)}</span>
                <ActiveBadge active={row.active} />
                <span className="row-actions">
                  {can("content.activities_edit") && <button type="button" className="btn btn-paper btn-small" onClick={() => setEditing(row)}>Sửa</button>}
                  {can("content.activities_status") && <button type="button" className="btn btn-paper btn-small" onClick={() => toggle(row)}>{row.active ? "Ẩn" : "Hiện lại"}</button>}
                </span>
              </li>
            ))}
          </ul>
          <Pagination paged={paged} />
        </LoadState>
      </Panel>
    </div>
  );
}
