import { useEffect, useMemo, useState } from "react";
import { imageUrl, money } from "../../api.js";
import { primaryImage } from "../../components/Cards.jsx";
import { request, useApi } from "../client.js";
import { ActiveBadge, Badge, Field, LoadState, MoneyInput, Pagination, Panel, SearchBox, distinct, includesText, useAdmin, usePaged } from "../ui.jsx";

const MAX_IMAGES = 5;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const STATUSES = ["Có sẵn", "Đang nhập", "Hết hàng"];
const STATUS_TONE = { "Có sẵn": "ok", "Đang nhập": "warn", "Hết hàng": "bad" };
const EMPTY = { name: "", category: "", stock: "0", price: "", costPrice: "", minStock: "10", unit: "đơn vị", status: "Có sẵn", description: "" };

const toForm = (product) => ({
  id: product.id,
  name: product.name || "",
  category: product.category || "",
  stock: String(product.stock ?? 0),
  price: String(product.price ?? ""),
  costPrice: String(product.cost_price ?? ""),
  minStock: String(product.min_stock ?? 10),
  unit: product.unit || "đơn vị",
  status: product.status || "Có sẵn",
  description: product.description || "",
});

const isWholeNumber = (value) => /^\d+$/.test(String(value).trim());

function ProductForm({ initial, existingImages = [], onSaved, onCancel }) {
  const { run, notify } = useAdmin();
  const categories = useApi("/categories");
  const [form, setForm] = useState(initial);
  const [images, setImages] = useState(existingImages);
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const editing = Boolean(initial.id);
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });
  const previews = useMemo(() => files.map((file) => ({ name: file.name, url: URL.createObjectURL(file) })), [files]);
  useEffect(() => () => previews.forEach((preview) => URL.revokeObjectURL(preview.url)), [previews]);

  function pickFiles(event) {
    const chosen = [...event.target.files];
    event.target.value = "";
    const wrongType = chosen.find((file) => !IMAGE_TYPES.includes(file.type));
    if (wrongType) return notify("error", `"${wrongType.name}" không phải ảnh JPG, PNG, WEBP hoặc GIF.`);
    const tooBig = chosen.find((file) => file.size > MAX_IMAGE_BYTES);
    if (tooBig) return notify("error", `"${tooBig.name}" lớn hơn 5MB.`);
    if (images.length + files.length + chosen.length > MAX_IMAGES) return notify("error", "Mỗi sản phẩm chỉ được tối đa 5 hình ảnh.");
    setFiles([...files, ...chosen]);
  }

  async function removeImage(image) {
    const ok = await run(() => request(`/products/${form.id}/images/${image.id}`, { method: "DELETE" }), "Đã xóa hình ảnh");
    if (ok) setImages(images.filter((item) => item.id !== image.id));
  }

  async function submit(event) {
    event.preventDefault();
    if (!form.name.trim()) return notify("error", "Tên sản phẩm không được để trống.");
    if (!form.category) return notify("error", "Vui lòng chọn loại sản phẩm.");
    if (!isWholeNumber(form.stock)) return notify("error", "Tồn kho phải là số nguyên không âm.");
    if (!isWholeNumber(form.minStock)) return notify("error", "Ngưỡng tồn tối thiểu phải là số nguyên không âm.");
    const body = {
      name: form.name.trim(), category: form.category, stock: Number(form.stock), price: Number(form.price || 0),
      costPrice: Number(form.costPrice || 0), minStock: Number(form.minStock), unit: form.unit.trim() || "đơn vị",
      status: form.status, description: form.description,
    };
    setBusy(true);
    const ok = await run(async () => {
      const saved = await request(editing ? `/products/${form.id}` : "/products", { method: editing ? "PUT" : "POST", body });
      const productId = editing ? form.id : saved.id;
      if (files.length) {
        const data = new FormData();
        files.forEach((file) => data.append("images", file));
        await request(`/products/${productId}/images`, { method: "POST", form: data });
      }
    }, "Đã lưu sản phẩm và bộ sưu tập ảnh");
    setBusy(false);
    if (ok) onSaved();
  }

  const categoryOptions = categories.data || [];
  const hasCurrent = categoryOptions.some((category) => category.name === form.category);

  return (
    <Panel title={editing ? "Cập nhật sản phẩm" : "Thêm sản phẩm mới"} subtitle="Mỗi sản phẩm có thể tải tối đa 5 hình ảnh, mỗi ảnh tối đa 5MB.">
      <form onSubmit={submit} className="stack">
        <div className="form-grid form-grid-3">
          <Field label="Tên sản phẩm *"><input id="product-name" value={form.name} onChange={set("name")} required /></Field>
          <Field label="Loại sản phẩm *">
            <select id="product-category" value={form.category} onChange={set("category")} required>
              <option value="">Chọn loại sản phẩm</option>
              {categoryOptions.map((category) => <option key={category.id} value={category.name}>{category.name}</option>)}
              {form.category && !hasCurrent && <option value={form.category}>{form.category} (đã ngừng dùng)</option>}
            </select>
          </Field>
          <Field label="Trạng thái">
            <select id="product-status" value={form.status} onChange={set("status")}>{STATUSES.map((status) => <option key={status}>{status}</option>)}</select>
          </Field>
          <Field label="Giá bán (đ)"><MoneyInput id="product-price" value={form.price} onChange={(value) => setForm({ ...form, price: value })} /></Field>
          <Field label="Giá vốn (đ)"><MoneyInput id="product-cost" value={form.costPrice} onChange={(value) => setForm({ ...form, costPrice: value })} /></Field>
          <Field label="Đơn vị tính"><input id="product-unit" value={form.unit} onChange={set("unit")} /></Field>
          <Field label="Tồn kho" hint={editing ? "Nên dùng Ghi nhận nhập / xuất để có lịch sử kho." : undefined}>
            <input id="product-stock" type="number" min="0" step="1" value={form.stock} onChange={set("stock")} />
          </Field>
          <Field label="Ngưỡng tồn tối thiểu"><input id="product-min-stock" type="number" min="0" step="1" value={form.minStock} onChange={set("minStock")} /></Field>
        </div>
        <fieldset className="subgroup">
          <legend>Bộ hình ảnh ({images.length + files.length}/{MAX_IMAGES})</legend>
          <div className="image-shelf">
            {images.map((image) => (
              <figure key={image.id}>
                <img src={imageUrl(image.path)} alt="" />
                {editing && <button type="button" aria-label="Xóa hình" onClick={() => removeImage(image)}>×</button>}
              </figure>
            ))}
            {previews.map((preview, i) => (
              <figure key={preview.url} className="is-new">
                <img src={preview.url} alt="" />
                <button type="button" aria-label={`Bỏ ${preview.name}`} onClick={() => setFiles(files.filter((_, index) => index !== i))}>×</button>
                <figcaption>{preview.name}</figcaption>
              </figure>
            ))}
            {images.length + files.length < MAX_IMAGES && (
              <label className="image-add">
                <input type="file" accept={IMAGE_TYPES.join(",")} multiple onChange={pickFiles} />
                <span>+ Thêm ảnh</span>
              </label>
            )}
          </div>
        </fieldset>
        <Field label="Mô tả chi tiết" wide><textarea id="product-description" rows="4" value={form.description} onChange={set("description")} /></Field>
        <div className="form-actions">
          <button type="submit" className="btn btn-door" disabled={busy}>{busy ? "Đang lưu…" : editing ? "Cập nhật" : "Thêm sản phẩm"}</button>
          {onCancel && <button type="button" className="btn btn-paper" onClick={onCancel}>Hủy</button>}
        </div>
      </form>
    </Panel>
  );
}

export function ProductsCreate() {
  const [round, setRound] = useState(0);
  return <ProductForm key={round} initial={EMPTY} onSaved={() => setRound(round + 1)} />;
}

export function ProductsList() {
  const { can, run, confirm, exportExcel } = useAdmin();
  const list = useApi("/products?all=1");
  const [editing, setEditing] = useState(null);
  const [filters, setFilters] = useState({ query: "", category: "", status: "" });
  const all = list.data || [];
  const rows = all.filter((p) =>
    includesText(filters.query, p.id, p.name, p.category, p.description) &&
    (!filters.category || p.category === filters.category) &&
    (!filters.status || p.status === filters.status));
  const paged = usePaged(rows, JSON.stringify(filters));

  async function toggle(product) {
    const next = !product.active;
    if (!next && !(await confirm({ title: "Ẩn sản phẩm?", message: `"${product.name}" sẽ không còn hiện trên website. Lịch sử kho và đơn hàng vẫn giữ nguyên.`, confirmLabel: "Ẩn sản phẩm" }))) return;
    const ok = await run(() => request(`/products/${product.id}/status`, { method: "PATCH", body: { active: next } }), next ? "Đã kích hoạt sản phẩm" : "Đã chuyển sản phẩm sang inactive");
    if (ok) list.reload();
  }

  const exportProducts = () => exportExcel("danh-sach-san-pham.xlsx", [{
    name: "Sản phẩm",
    rows: all,
    columns: [
      { header: "Mã", key: "id", width: 10 }, { header: "Tên sản phẩm", key: "name", width: 28 }, { header: "Loại", key: "category", width: 20 },
      { header: "Tồn kho", key: "stock", width: 12, number: true }, { header: "Giá bán", key: "price", width: 18, number: true },
      { header: "Giá vốn", key: "cost_price", width: 18, number: true }, { header: "Đơn vị", key: "unit", width: 12 },
      { header: "Tồn tối thiểu", key: "min_stock", width: 14, number: true }, { header: "Trạng thái", key: "status", width: 16 },
      { header: "Active", value: (row) => (row.active ? "Active" : "Inactive"), width: 12 }, { header: "Mô tả", key: "description", width: 40 },
    ],
  }]);

  return (
    <div className="stack">
      {editing && (
        <ProductForm key={editing.id} initial={toForm(editing)} existingImages={editing.images?.filter((image) => typeof image.id === "number") || []}
          onSaved={() => { setEditing(null); list.reload(); }} onCancel={() => setEditing(null)} />
      )}
      <Panel title="Danh sách sản phẩm" subtitle={`${rows.length} / ${all.length} sản phẩm`} actions={<button type="button" className="btn btn-paper btn-small" onClick={exportProducts}>Xuất Excel</button>}>
        <div className="filters">
          <SearchBox value={filters.query} onChange={(query) => setFilters({ ...filters, query })} placeholder="Tìm mã, tên hoặc mô tả sản phẩm..." />
          <select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })} aria-label="Lọc loại">
            <option value="">Tất cả loại sản phẩm</option>{distinct(all, (p) => p.category).map((name) => <option key={name}>{name}</option>)}
          </select>
          <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} aria-label="Lọc trạng thái">
            <option value="">Tất cả trạng thái</option>{distinct(all, (p) => p.status).map((name) => <option key={name}>{name}</option>)}
          </select>
        </div>
        <LoadState resource={list} empty={list.data && !rows.length ? "Không có sản phẩm phù hợp bộ lọc." : ""}>
          <ul className="card-list">
            {paged.visible.map((product) => {
              const image = primaryImage(product);
              const low = Number(product.stock) <= Number(product.min_stock);
              return (
                <li key={product.id} className={product.active ? "" : "is-off"}>
                  <span className="thumb">{image ? <img src={imageUrl(image)} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} /> : "▦"}</span>
                  <span className="card-text">
                    <strong>{product.name}</strong>
                    #{product.id} · {product.category} · {money(product.price)} · {product.images?.length || 0} hình · <span className={low ? "text-warn" : ""}>Tồn {product.stock} {product.unit}</span>
                  </span>
                  <span className="badge-pair"><Badge tone={STATUS_TONE[product.status] || "neutral"}>{product.status}</Badge><ActiveBadge active={product.active} /></span>
                  <span className="row-actions">
                    {can("products.edit") && <button type="button" className="btn btn-paper btn-small" onClick={() => setEditing(product)}>Sửa</button>}
                    {can("products.change_status") && <button type="button" className="btn btn-paper btn-small" onClick={() => toggle(product)}>{product.active ? "Ẩn" : "Hiện lại"}</button>}
                  </span>
                </li>
              );
            })}
          </ul>
          <Pagination paged={paged} />
        </LoadState>
      </Panel>
    </div>
  );
}
