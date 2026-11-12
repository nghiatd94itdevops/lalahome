import { useState } from "react";
import { money } from "../api.js";

const CONTACT_FIELDS = [
  { key: "customerName", label: "Họ tên *", autoComplete: "name" },
  { key: "phone", label: "Số điện thoại *", type: "tel", autoComplete: "tel" },
  { key: "email", label: "Email", type: "email", autoComplete: "email" },
  { key: "companyName", label: "Công ty", autoComplete: "organization" },
];

function problemWith(form) {
  if (!form.customerName.trim() || !form.phone.trim()) return "Bạn cho mình xin họ tên và số điện thoại nhé.";
  if (!form.items.length) return "Phiếu cần ít nhất một sản phẩm.";
  if (form.items.some((item) => !Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1)) return "Số lượng phải là số nguyên từ 1.";
  return "";
}

// The quote request the assistant filled in from the conversation. Nothing is sent until the visitor presses the
// button; `onSubmit(form)` resolves to { id } or { error }. A draft replaced by a newer one stays read-only.
export default function QuoteDraftCard({ draft, sentId = null, superseded = false, onSubmit }) {
  const [form, setForm] = useState(() => ({ ...draft, items: draft.items.map((item) => ({ ...item })) }));
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState("");

  if (sentId) {
    return (
      <section className="quote-draft is-sent" aria-label="Yêu cầu báo giá đã gửi">
        <p className="quote-draft-title">✓ Đã gửi yêu cầu báo giá #{sentId}</p>
        <p className="quote-draft-hint">Nhân viên LalaFlow sẽ liên hệ {draft.customerName} để gửi báo giá chính thức.</p>
        <ul className="quote-draft-summary">{draft.items.map((item) => <li key={item.productId}>{item.name} × {item.quantity} {item.unit}</li>)}</ul>
      </section>
    );
  }
  if (superseded) {
    return <p className="quote-draft-old">Phiếu nháp cũ, đã có phiếu mới bên dưới.</p>;
  }

  const change = (key) => (event) => setForm({ ...form, [key]: event.target.value });
  const changeQuantity = (productId) => (event) => setForm({
    ...form,
    items: form.items.map((item) => (item.productId === productId ? { ...item, quantity: event.target.value } : item)),
  });
  const removeItem = (productId) => setForm({ ...form, items: form.items.filter((item) => item.productId !== productId) });

  async function send(event) {
    event.preventDefault();
    const found = problemWith(form);
    setProblem(found);
    if (found) return;
    setSending(true);
    const result = await onSubmit({ ...form, items: form.items.map((item) => ({ ...item, quantity: Number(item.quantity) })) });
    setSending(false);
    if (result.error) setProblem(result.error);
  }

  return (
    <form className="quote-draft" onSubmit={send} aria-label="Phiếu yêu cầu báo giá nháp" noValidate>
      <p className="quote-draft-title">Phiếu yêu cầu báo giá <span>nháp</span></p>
      <p className="quote-draft-hint">Mimi đã điền từ cuộc trò chuyện. Bạn xem lại, sửa nếu cần rồi bấm gửi.</p>
      <div className="quote-draft-fields">
        {CONTACT_FIELDS.map((field) => (
          <label key={field.key}>
            <span>{field.label}</span>
            <input name={field.key} type={field.type || "text"} autoComplete={field.autoComplete} value={form[field.key]} onChange={change(field.key)} />
          </label>
        ))}
      </div>
      <ul className="quote-draft-items">
        {form.items.map((item) => (
          <li key={item.productId}>
            <span className="quote-draft-product">
              <strong>{item.name}</strong>
              <small>{money(item.price)}/{item.unit}{item.status ? ` · ${item.status}` : ""}</small>
            </span>
            <label className="quote-draft-quantity">
              <span className="visually-hidden">Số lượng {item.name}</span>
              <input type="number" min="1" step="1" inputMode="numeric" value={item.quantity} onChange={changeQuantity(item.productId)} />
              <span>{item.unit}</span>
            </label>
            <button type="button" className="quote-draft-remove" aria-label={`Bỏ ${item.name} khỏi phiếu`} onClick={() => removeItem(item.productId)}>×</button>
          </li>
        ))}
      </ul>
      <label className="quote-draft-note">
        <span>Ghi chú</span>
        <textarea name="note" rows="2" value={form.note} onChange={change("note")} />
      </label>
      {!form.email.trim() && <p className="quote-draft-fine">Thêm email để nhận báo giá qua email; để trống thì nhân viên sẽ gọi điện cho bạn.</p>}
      {problem && <p className="quote-draft-problem" role="alert">{problem}</p>}
      <button type="submit" className="btn btn-door quote-draft-send" disabled={sending}>{sending ? "Đang gửi…" : "Gửi yêu cầu báo giá"}</button>
      <p className="quote-draft-fine">Giá trên là giá niêm yết; báo giá chính thức do nhân viên gửi sau.</p>
    </form>
  );
}
