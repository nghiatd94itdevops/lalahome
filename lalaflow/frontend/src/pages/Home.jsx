import { Link } from "react-router-dom";
import { HOME_ART, phoneHref, splitList } from "../api.js";
import { ActivityCard, ProductCard } from "../components/Cards.jsx";
import { MimiNote, PokableMimi, useMimiNow } from "../components/Mimi.jsx";
import { PaintedPanel, SectionHead } from "../components/Scenery.jsx";
import { useSeo } from "../seo.js";

const FEATURED_PRODUCTS = 4;

const STAT_LABELS = [
  ["years", "Năm kinh nghiệm"],
  ["customers", "Khách hàng tin chọn"],
  ["products", "Dòng sản phẩm"],
  ["delivery", "Giao hàng đúng hẹn"],
];

// The mascot's corner: what Mimi is doing at this hour (from the brand kit's time-of-day states), dressed for the
// season and any holiday, with a way into the assistant.
function MimiNow({ onAsk }) {
  const now = useMimiNow();
  return (
    <section className="wrap section" aria-label="Mimi lúc này">
      <div className="mimi-now">
        <PokableMimi state={now.state} season={now.season} festival={now.festival} className="mimi-now-figure" />
        <div className="mimi-now-copy">
          <p className="eyebrow">Mimi lúc này · {now.time}</p>
          <h2>{now.line}</h2>
          <p className="mimi-now-slot">{now.label}</p>
          <p>Mimi là mèo chữ L của LaLaHome. Cần tìm giấy, bao bì hay một báo giá nhanh? Hỏi Mimi, trợ lý AI sẽ tìm giúp bạn ngay.</p>
          <button type="button" className="btn btn-door" onClick={onAsk}>Hỏi Mimi →</button>
        </div>
      </div>
    </section>
  );
}

export default function HomePage({ content, products, activities, dataState, openAssistantPage }) {
  const { company, home, about, stats, contact } = content;
  useSeo({ title: `${company.name} | Giấy, bao bì và giải pháp in ấn`, description: company.description, path: "/", company });

  return (
    <>
      <section className="wrap welcome-hero">
        <PaintedPanel focus="50% 38%" className="hero-frame hero-frame-tall">
          <div className="hero-note hero-note-wide">
            <p className="hanging-tag">{home.heroBadge}</p>
            <h1>{home.heroTitle} <em>{home.heroHighlight}</em></h1>
            <p className="lead">{home.heroText}</p>
            <div className="actions">
              <Link to="/san-pham" className="btn btn-door">{home.primaryButton} →</Link>
              <Link to="/gioi-thieu" className="btn btn-paper">{home.secondaryButton} →</Link>
            </div>
          </div>
          <div className="seal" aria-label={`${home.certificateTitle}: ${home.certificateText}`}>
            <strong>{home.certificateTitle}</strong>
            <span>{home.certificateText}</span>
          </div>
        </PaintedPanel>
        <ul className="trust-strip" aria-label="Cam kết dịch vụ">
          <li><span aria-hidden="true">☎</span><div><strong>Hotline tư vấn</strong><a href={phoneHref(company.phone)}>{company.phone}</a></div></li>
          <li><span aria-hidden="true">◷</span><div><strong>Giờ làm việc</strong>{company.workingHours}</div></li>
          <li><span aria-hidden="true">⛟</span><div><strong>Giao hàng</strong>Toàn quốc, đúng hẹn {stats.delivery}</div></li>
          <li><span aria-hidden="true">✓</span><div><strong>Báo giá</strong>Miễn phí, phản hồi trong ngày làm việc</div></li>
        </ul>
      </section>

      <section className="wrap stats-row" aria-label="Số liệu nổi bật">
        {STAT_LABELS.map(([key, label]) => (
          <div className="stat-plaque" key={key}>
            <strong>{stats[key]}</strong>
            <span>{label}</span>
          </div>
        ))}
      </section>

      <MimiNow onAsk={openAssistantPage} />

      <section className="wrap section">
        <SectionHead
          eyebrow={home.productsEyebrow}
          title={home.productsTitle}
          action={<Link to="/san-pham" className="btn btn-paper">{home.viewAllButton} →</Link>}
        />
        {dataState === "loading" && <p className="muted">Đang mở kho hàng…</p>}
        {dataState === "error" && <MimiNote state="error"><p>Chưa tải được sản phẩm, bạn thử tải lại trang nhé.</p></MimiNote>}
        <div className="product-grid">
          {products.slice(0, FEATURED_PRODUCTS).map((product) => <ProductCard key={product.id} product={product} />)}
        </div>
      </section>

      <section className="wrap section story-split">
        <div className="story-window" style={{ backgroundImage: `url(${HOME_ART})` }}>
          <span className="story-label">{home.storyLabel}</span>
        </div>
        <div className="story-copy">
          <p className="eyebrow">{home.aboutEyebrow}</p>
          <h2>{about.title}</h2>
          <p>{about.story}</p>
          <ul className="leaf-list">
            {splitList(home.aboutFeatures).map((feature) => <li key={feature}>{feature}</li>)}
          </ul>
          <Link to="/gioi-thieu" className="btn btn-door">{home.aboutButton} →</Link>
        </div>
      </section>

      <section className="wrap section">
        <SectionHead
          eyebrow={home.activitiesEyebrow}
          title={home.activitiesTitle}
          action={<Link to="/hoat-dong" className="btn btn-paper">{home.viewAllButton} →</Link>}
        />
        <div className="activity-grid">
          {activities.slice(0, 3).map((activity) => <ActivityCard key={activity.id} activity={activity} />)}
        </div>
      </section>

      <section className="wrap section">
        <div className="door-cta">
          <span className="lamp lamp-l" aria-hidden="true" />
          <span className="lamp lamp-r" aria-hidden="true" />
          <p className="eyebrow">{home.ctaEyebrow}</p>
          <h2>{contact.heading}</h2>
          <p>{contact.subheading}</p>
          <div className="actions">
            <a href={phoneHref(company.phone)} className="btn btn-glow">{contact.buttonText} →</a>
            <Link to="/yeu-cau-bao-gia" className="btn btn-paper">Gửi yêu cầu báo giá</Link>
          </div>
        </div>
      </section>
    </>
  );
}
