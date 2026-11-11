import { useEffect, useState } from "react";
import { fallbackContent, mergeContent } from "../../content.js";
import { request, useApi } from "../client.js";
import { Field, LoadState, Panel, useAdmin } from "../ui.jsx";

// [section, key, label, textarea?]
const GROUPS = [
  {
    no: "01", title: "Thông tin và liên hệ doanh nghiệp", fields: [
      ["company", "name", "Tên doanh nghiệp"], ["company", "tagline", "Slogan"], ["company", "phone", "Hotline"], ["company", "email", "Email"],
      ["company", "zaloUrl", "Link nhắn tin Zalo"], ["company", "facebookUrl", "Link Facebook Messenger"], ["company", "address", "Địa chỉ"],
      ["company", "taxCode", "Mã số thuế"], ["company", "foundedYear", "Năm thành lập"], ["company", "workingHours", "Giờ làm việc"],
      ["company", "description", "Mô tả doanh nghiệp", true],
    ],
  },
  {
    no: "02", title: "Nội dung trang chủ", subgroups: [
      ["Banner chính", [["home", "heroBadge", "Nhãn banner"], ["home", "heroTitle", "Tiêu đề chính"], ["home", "heroHighlight", "Phần tiêu đề nổi bật"],
        ["home", "primaryButton", "Nút sản phẩm"], ["home", "secondaryButton", "Nút giới thiệu"], ["home", "certificateTitle", "Tiêu đề chứng nhận"],
        ["home", "certificateText", "Nội dung chứng nhận"], ["home", "heroText", "Mô tả banner", true]]],
      ["Khối sản phẩm và giới thiệu", [["home", "productsEyebrow", "Nhãn sản phẩm"], ["home", "productsTitle", "Tiêu đề sản phẩm"], ["home", "aboutEyebrow", "Nhãn giới thiệu"],
        ["home", "aboutButton", "Nút giới thiệu"], ["home", "storyLabel", "Nhãn trên hình giới thiệu"], ["home", "aboutFeatures", "Điểm nổi bật (ngăn cách bởi |)"]]],
      ["Hoạt động và kêu gọi liên hệ", [["home", "activitiesEyebrow", "Nhãn hoạt động"], ["home", "activitiesTitle", "Tiêu đề hoạt động"],
        ["home", "viewAllButton", "Nội dung xem tất cả"], ["home", "ctaEyebrow", "Nhãn kêu gọi liên hệ"]]],
    ],
  },
  {
    no: "03", title: "Về chúng tôi, sứ mệnh và tầm nhìn", fields: [
      ["about", "title", "Tiêu đề câu chuyện"], ["about", "story", "Câu chuyện thương hiệu", true], ["about", "mission", "Sứ mệnh", true],
      ["about", "vision", "Tầm nhìn", true], ["about", "values", "Giá trị cốt lõi (ngăn cách bởi |)"],
    ],
  },
  {
    no: "04", title: "Tiêu đề các trang thông tin", subgroups: [
      ["Trang Giới thiệu", [["pages", "aboutEyebrow", "Nhãn nhỏ"], ["pages", "aboutHeroTitle", "Tiêu đề trang"], ["pages", "aboutHeroText", "Mô tả mở đầu", true],
        ["pages", "aboutJourneyLabel", "Nhãn hành trình"], ["pages", "aboutJourneyTitle", "Tiêu đề hành trình"]]],
      ["Trang Thông tin công ty", [["pages", "infoEyebrow", "Nhãn nhỏ"], ["pages", "infoHeroTitle", "Tiêu đề trang"], ["pages", "infoHeroText", "Mô tả mở đầu", true]]],
      ["Trang Hoạt động", [["pages", "activityEyebrow", "Nhãn nhỏ"], ["pages", "activityHeroTitle", "Tiêu đề trang"], ["pages", "activityHeroText", "Mô tả mở đầu", true]]],
      ["Trang Sản phẩm", [["pages", "productEyebrow", "Nhãn nhỏ"], ["pages", "productHeroTitle", "Tiêu đề trang"], ["pages", "productHeroText", "Mô tả mở đầu", true]]],
    ],
  },
  {
    no: "05", title: "Số liệu nổi bật", fields: [
      ["stats", "years", "Năm kinh nghiệm"], ["stats", "customers", "Khách hàng"], ["stats", "products", "Dòng sản phẩm"], ["stats", "delivery", "Tỷ lệ giao đúng hẹn"],
    ],
  },
  {
    no: "06", title: "Khối kêu gọi liên hệ", fields: [
      ["contact", "heading", "Tiêu đề liên hệ"], ["contact", "subheading", "Nội dung hỗ trợ", true], ["contact", "buttonText", "Nội dung nút"],
    ],
  },
];

export default function Content() {
  const { run } = useAdmin();
  const remote = useApi("/site-content");
  const [form, setForm] = useState(fallbackContent);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (remote.data) setForm(mergeContent(remote.data));
  }, [remote.data]);

  const input = ([section, key, label, multiline]) => {
    const props = { id: `content-${section}-${key}`, value: form[section][key] ?? "", onChange: (e) => setForm({ ...form, [section]: { ...form[section], [key]: e.target.value } }) };
    return <Field key={`${section}.${key}`} label={label} wide={multiline}>{multiline ? <textarea rows="3" {...props} /> : <input {...props} />}</Field>;
  };

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    const ok = await run(
      () => Promise.all(Object.keys(fallbackContent).map((section) => request(`/site-content/${section}`, { method: "PUT", body: form[section] }))),
      "Đã cập nhật toàn bộ nội dung website",
    );
    setSaving(false);
    if (ok) remote.reload();
  }

  return (
    <LoadState resource={remote}>
      <form className="stack" onSubmit={save}>
        {GROUPS.map((group) => (
          <Panel key={group.no} title={<><span className="panel-no">{group.no}</span>{group.title}</>}>
            {group.fields && <div className="form-grid">{group.fields.map(input)}</div>}
            {group.subgroups?.map(([title, fields]) => (
              <fieldset key={title} className="subgroup">
                <legend>{title}</legend>
                <div className="form-grid">{fields.map(input)}</div>
              </fieldset>
            ))}
          </Panel>
        ))}
        <div className="sticky-save">
          <button type="submit" className="btn btn-door btn-large" disabled={saving}>{saving ? "Đang lưu…" : "Lưu toàn bộ nội dung"}</button>
        </div>
      </form>
    </LoadState>
  );
}
