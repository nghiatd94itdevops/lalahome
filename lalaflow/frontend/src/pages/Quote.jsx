import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { postJson } from "../api.js";
import { PageHero } from "../components/Shell.jsx";
import { useSeo } from "../seo.js";

const EMPTY_FORM = { customerName: "", phone: "", email: "", companyName: "", productId: "", productName: "", quantity: 1, message: "" };

export default function QuoteRequestPage({ content, products, notify }) {
  const { company, contact } = content;
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState(EMPTY_FORM);
  const [sending, setSending] = useState(false);
  useSeo({
    title: `Yêu cầu báo giá | ${company.name}`,
    description: `Gửi yêu cầu để nhận tư vấn sản phẩm và báo giá từ ${company.name}.`,
    path: "/yeu-cau-bao-gia",
    company,
  });

  const preselectedId = searchParams.get("product");
  useEffect(() => {
    const product = products.find((p) => String(p.id) === preselectedId);
    if (product) setForm((current) => ({ ...current, productId: String(product.id), productName: product.name }));
  }, [preselectedId, products]);

  const update = (field) => (event) => setForm({ ...form, [field]: event.target.value });
  const chooseProduct = (event) => {
    const product = products.find((p) => String(p.id) === event.target.value);
    setForm({ ...form, productId: event.target.value, productName: product?.name || "" });
  };

  async function submit(event) {
    event.preventDefault();
    if (!form.customerName.trim() || !form.phone.trim()) {
      notify("error", "Vui lòng nhập họ tên và số điện thoại.");
      return;
    }
    setSending(true);
    try {
      const { ok, data } = await postJson("/quote-requests", {
        ...form,
        productId: form.productId ? Number(form.productId) : null,
        quantity: Number(form.quantity) || 1,
      });
      if (!ok) {
        notify("error", data.error || "Không thể gửi yêu cầu, vui lòng thử lại.");
        return;
      }
      setForm(EMPTY_FORM);
      notify("success", "Yêu cầu đã được gửi. Nhân viên LalaFlow sẽ liên hệ sớm.");
    } catch (error) {
      notify("error", `Chưa kết nối được máy chủ (${error.message}). Thông tin bạn nhập vẫn được giữ để thử lại.`);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <PageHero
        eyebrow="YÊU CẦU BÁO GIÁ"
        title="Nhận tư vấn và báo giá phù hợp"
        text="Gửi nhu cầu của bạn, đội ngũ LalaFlow sẽ chủ động liên hệ và chuẩn bị báo giá chi tiết."
        focus="97% 40%"
      />

      <section className="wrap section quote-layout">
        <aside className="quote-aside">
          <p className="eyebrow">TƯ VẤN DOANH NGHIỆP</p>
          <h2>Chúng tôi cần một vài thông tin</h2>
          <p>{contact.subheading}</p>
          <div className="note-card">
            <p><strong>Hotline:</strong> {company.phone}</p>
            <p><strong>Giờ làm việc:</strong> {company.workingHours}</p>
          </div>
        </aside>

        <form className="letter-form" onSubmit={submit} noValidate>
          <span className="stamp">Thư gửi {company.name}</span>
          <div className="form-grid">
            <label>Họ tên *<input id="quote-name" value={form.customerName} onChange={update("customerName")} autoComplete="name" required /></label>
            <label>Số điện thoại *<input id="quote-phone" type="tel" value={form.phone} onChange={update("phone")} autoComplete="tel" required /></label>
            <label>Email<input id="quote-email" type="email" value={form.email} onChange={update("email")} autoComplete="email" /></label>
            <label>Công ty<input id="quote-company" value={form.companyName} onChange={update("companyName")} autoComplete="organization" /></label>
            <label>Sản phẩm quan tâm
              <select id="quote-product" value={form.productId} onChange={chooseProduct}>
                <option value="">Chưa xác định</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label>Số lượng dự kiến<input id="quote-quantity" type="number" min="1" value={form.quantity} onChange={update("quantity")} /></label>
            <label className="span-2">Nội dung cần tư vấn<textarea id="quote-message" rows="5" value={form.message} onChange={update("message")} /></label>
          </div>
          <button type="submit" className="btn btn-door btn-large" disabled={sending}>
            {sending ? "Đang gửi…" : "Gửi yêu cầu báo giá →"}
          </button>
        </form>
      </section>
    </>
  );
}
