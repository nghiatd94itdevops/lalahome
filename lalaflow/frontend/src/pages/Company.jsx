import { phoneHref, splitList } from "../api.js";
import { PokableMimi } from "../components/Mimi.jsx";
import { SectionHead } from "../components/Scenery.jsx";
import { PageHero } from "../components/Shell.jsx";
import { useSeo } from "../seo.js";

const VALUE_NOTE = "Nền tảng cho mọi quyết định và cam kết của LalaFlow với khách hàng.";
// Three of the brand kit's states, each tied to something Mimi does for a visitor on this site.
const MIMI_POSES = [
  { state: "greet", title: "Chào bạn, mình là Mimi!", text: "Mimi đợi bạn ở nút Trợ lý AI, sẵn sàng trò chuyện bằng chữ hoặc giọng nói." },
  { state: "searching", title: "Để Mimi tra giúp", text: "Hỏi loại giấy, công dụng, giá hay tồn kho: Mimi tìm ngay trong kho hàng LalaFlow." },
  { state: "success", title: "Xong rồi nè!", text: "Gửi yêu cầu báo giá hay đánh giá sản phẩm, Mimi báo ngay khi đã nhận." },
];

function MeetMimi({ onAsk }) {
  return (
    <section className="wrap section meet-mimi" id="gap-mimi">
      <SectionHead eyebrow="LINH VẬT LALAHOME" title="Gặp Mimi" />
      <p className="lead meet-mimi-intro">
        Mimi là mèo chữ L của LaLaHome: thân ghép mảng vải có đường may và mảng giấy gấp nếp, tai origami, vòng cổ đổi màu
        theo tâm trạng. Mimi đồng hành cùng bạn trên khắp trang web, từ lúc tìm sản phẩm đến khi nhận báo giá.
      </p>
      <div className="meet-mimi-grid">
        {MIMI_POSES.map((pose) => (
          <article className="meet-mimi-card" key={pose.state}>
            <PokableMimi state={pose.state} className="meet-mimi-figure" />
            <h3>{pose.title}</h3>
            <p>{pose.text}</p>
          </article>
        ))}
      </div>
      <button type="button" className="btn btn-door" onClick={onAsk}>Trò chuyện với Mimi →</button>
    </section>
  );
}

export function AboutPage({ content, openAssistantPage }) {
  const { company, about, pages } = content;
  useSeo({ title: `Giới thiệu ${company.name}`, description: pages.aboutHeroText || about.story, path: "/gioi-thieu", company });

  return (
    <>
      <PageHero eyebrow={pages.aboutEyebrow} title={pages.aboutHeroTitle} text={pages.aboutHeroText} focus="80% 46%" />

      <section className="wrap section journey">
        <div>
          <p className="eyebrow">{pages.aboutJourneyLabel}</p>
          <h2>{pages.aboutJourneyTitle}</h2>
        </div>
        <div className="letter">
          <span className="stamp">Từ {company.foundedYear}</span>
          <p>{about.story}</p>
          <p>{company.description}</p>
          <p className="signature">— {company.name}</p>
        </div>
      </section>

      <section className="wrap section vision-row">
        <article className="window-card">
          <span className="window-number">01</span>
          <h3>Sứ mệnh</h3>
          <p>{about.mission}</p>
        </article>
        <article className="window-card">
          <span className="window-number">02</span>
          <h3>Tầm nhìn</h3>
          <p>{about.vision}</p>
        </article>
      </section>

      <MeetMimi onAsk={openAssistantPage} />

      <section className="wrap section" id="gia-tri-cot-loi">
        <SectionHead eyebrow="GIÁ TRỊ CỐT LÕI" title="Điều chúng tôi luôn gìn giữ" />
        <div className="value-grid">
          {splitList(about.values).map((value, i) => (
            <article className="value-tag" key={value}>
              <span>{String(i + 1).padStart(2, "0")}</span>
              <h3>{value}</h3>
              <p>{VALUE_NOTE}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

export function InfoPage({ content }) {
  const { company, pages } = content;
  useSeo({
    title: `Thông tin công ty ${company.name}`,
    description: `${company.name} – ${company.address}. Liên hệ ${company.phone}.`,
    path: "/thong-tin",
    company,
  });

  const rows = [
    ["Tên doanh nghiệp", company.name],
    ["Năm thành lập", company.foundedYear],
    ["Mã số thuế", company.taxCode],
    ["Địa chỉ", company.address],
    ["Điện thoại", <a href={phoneHref(company.phone)}>{company.phone}</a>],
    ["Email", <a href={`mailto:${company.email}`}>{company.email}</a>],
    ["Thời gian làm việc", company.workingHours],
  ];

  return (
    <>
      <PageHero eyebrow={pages.infoEyebrow} title={pages.infoHeroTitle} text={pages.infoHeroText} focus="50% 52%" />

      <section className="wrap section info-layout">
        <aside className="nameplate">
          <span className="nameplate-screws" aria-hidden="true" />
          <p className="nameplate-name">{company.name}</p>
          <p>{company.tagline}</p>
          <span className="verified">✓ Thông tin đã xác thực</span>
        </aside>
        <dl className="ledger">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="wrap section">
        <div className="door-cta door-cta-split">
          <div>
            <p className="eyebrow">Hotline tư vấn</p>
            <a className="big-phone" href={phoneHref(company.phone)}>{company.phone}</a>
          </div>
          <div>
            <p className="eyebrow">Giờ làm việc</p>
            <p className="big-hours">{company.workingHours}</p>
          </div>
        </div>
      </section>
    </>
  );
}
