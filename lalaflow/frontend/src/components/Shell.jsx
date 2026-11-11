import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { HOME_ART, HOME_URL, phoneHref } from "../api.js";
import { Mimi } from "./Mimi.jsx";
import { PaintedPanel } from "./Scenery.jsx";
import { isStandalone } from "./InstallBanner.jsx";

const NAV = [
  { to: "/gioi-thieu", label: "Giới thiệu" },
  { to: "/thong-tin", label: "Thông tin" },
  { to: "/hoat-dong", label: "Hoạt động" },
  { to: "/san-pham", label: "Sản phẩm" },
];

// Must match the phone breakpoint in styles.css, where the bottom tab bar replaces the floating buttons.
export const PHONE_QUERY = "(max-width: 700px)";

function HouseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 11 12 4l9 7" /><path d="M6 10v9h12v-9" /><path d="M10 19v-5h4v5" />
    </svg>
  );
}

function ReloadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 12a8 8 0 1 1-2.34-5.66" /><path d="M20 4v5h-5" />
    </svg>
  );
}

export function Header({ company }) {
  const [open, setOpen] = useState(false);
  const [isApp] = useState(isStandalone);
  const location = useLocation();
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <header className="site-header">
      <div className="wrap header-row">
        <Link to="/" className="brand-sign" aria-label={`${company.name} – trang khách hàng`}>
          <span className="brand-chain" aria-hidden="true" />
          <span className="brand-board">{company.name}</span>
        </Link>
        <div className="header-actions">
          {/* Only in the installed app: there is no browser reload button there. */}
          {isApp && (
            <button className="app-reload" type="button" aria-label="Tải lại trang" title="Tải lại trang" onClick={() => window.location.reload()}>
              <ReloadIcon />
            </button>
          )}
          <button className="menu-toggle" type="button" aria-expanded={open} aria-controls="site-nav" onClick={() => setOpen(!open)}>
            {open ? "Đóng" : "Menu"}
          </button>
        </div>
        <nav id="site-nav" className={`site-nav ${open ? "is-open" : ""}`} aria-label="Điều hướng chính">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} className="nav-pill">{item.label}</NavLink>
          ))}
          <NavLink to="/yeu-cau-bao-gia" className="nav-pill nav-cta">Yêu cầu báo giá</NavLink>
          <a href={HOME_URL} className="nav-home" title="Về ngôi nhà LalaHome"><HouseIcon /><span>Về nhà</span></a>
        </nav>
      </div>
    </header>
  );
}

export function PageHero({ eyebrow, title, text, focus, children }) {
  return (
    <section className="wrap page-hero">
      <PaintedPanel focus={focus} className="hero-frame">
        <div className="hero-note">
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h1>{title}</h1>
          {text && <p className="lead">{text}</p>}
          {children}
        </div>
      </PaintedPanel>
    </section>
  );
}

export const contactChannels = (company) => [
  company.zaloUrl && { href: company.zaloUrl, label: "Nhắn tin Zalo", mark: "Z", external: true },
  company.facebookUrl && { href: company.facebookUrl, label: "Nhắn tin Facebook", mark: "f", external: true },
  company.phone && { href: phoneHref(company.phone), label: `Gọi ${company.phone}`, mark: "☎" },
].filter(Boolean);

export function ContactChannels({ company, open, onOpenChange }) {
  const channels = contactChannels(company);
  if (!channels.length) return null;

  return (
    <div className={`birdhouse ${open ? "is-open" : ""}`}>
      {open && (
        <ul className="channel-list" id="contact-channels">
          {channels.map((channel) => (
            <li key={channel.label}>
              <a href={channel.href} {...(channel.external ? { target: "_blank", rel: "noreferrer" } : {})}>
                <span className="channel-mark" aria-hidden="true">{channel.mark}</span>{channel.label}
              </a>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="birdhouse-button" aria-expanded={open} onClick={() => onOpenChange(!open)}>
        <svg viewBox="0 0 40 44" aria-hidden="true">
          <path d="M4 18 20 4l16 14" fill="#c8553a" stroke="#5a3417" strokeWidth="2.5" strokeLinejoin="round" />
          <rect x="8" y="17" width="24" height="22" rx="2" fill="#d9a46f" stroke="#5a3417" strokeWidth="2.5" />
          <circle cx="20" cy="27" r="4.5" fill="#3b2a1e" />
          <path d="M20 36v6" stroke="#5a3417" strokeWidth="2.5" />
        </svg>
        <span>{open ? "Đóng" : "Liên hệ"}</span>
      </button>
    </div>
  );
}

const TAB_ICONS = {
  home: <><path d="M3 11 12 4l9 7" /><path d="M6 10v9h12v-9" /><path d="M10 19v-5h4v5" /></>,
  products: <><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></>,
  quote: <><path d="M7 3h7l4 4v14H7Z" /><path d="M14 3v4h4M10 12h5M10 16h5" /></>,
  contact: <path d="M6.5 4h3l1.5 4-2 1.5a10 10 0 0 0 5.5 5.5l1.5-2 4 1.5v3a2 2 0 0 1-2 2A16 16 0 0 1 4.5 6a2 2 0 0 1 2-2Z" />,
};

function TabIcon({ name }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true">{TAB_ICONS[name]}</svg>;
}

// Phone-only navigation (hidden by CSS on wider screens): the main pages plus the assistant and contact panels,
// which on desktop open from the floating buttons instead.
export function TabBar({ company, chatOpen, onChat, contactOpen, onContact }) {
  const hasContact = contactChannels(company).length > 0;
  return (
    <nav className="tab-bar" aria-label="Thanh điều hướng điện thoại">
      <NavLink to="/" end className="tab"><TabIcon name="home" /><span>Trang chủ</span></NavLink>
      <NavLink to="/san-pham" className="tab"><TabIcon name="products" /><span>Sản phẩm</span></NavLink>
      <button type="button" className="tab" aria-expanded={chatOpen} aria-controls="chat-panel" onClick={onChat}><Mimi className="tab-mimi" /><span>Trợ lý AI</span></button>
      <NavLink to="/yeu-cau-bao-gia" className="tab"><TabIcon name="quote" /><span>Báo giá</span></NavLink>
      {hasContact && <button type="button" className="tab" aria-expanded={contactOpen} aria-controls="contact-channels" onClick={onContact}><TabIcon name="contact" /><span>Liên hệ</span></button>}
    </nav>
  );
}

export function Footer({ company }) {
  return (
    <footer className="site-footer">
      <div className="garden-edge" style={{ backgroundImage: `url(${HOME_ART})` }} aria-hidden="true" />
      <div className="footer-wood">
        <div className="wrap footer-grid">
          <div>
            <p className="footer-brand">{company.name}</p>
            <p>{company.description}</p>
          </div>
          <div>
            <p className="footer-title">Khám phá</p>
            <Link to="/gioi-thieu">Giới thiệu</Link>
            <Link to="/san-pham">Sản phẩm</Link>
            <Link to="/hoat-dong">Hoạt động</Link>
            <a href={HOME_URL}>Ngôi nhà LalaHome</a>
          </div>
          <div>
            <p className="footer-title">Liên hệ</p>
            <a href={phoneHref(company.phone)}>{company.phone}</a>
            <a href={`mailto:${company.email}`}>{company.email}</a>
            <span>{company.address}</span>
          </div>
        </div>
        <div className="wrap footer-base">
          <span>© {new Date().getFullYear()} {company.name}. Chất liệu tốt cho tương lai bền vững.</span>
          <Link to="/admin">Đăng nhập quản trị</Link>
        </div>
      </div>
    </footer>
  );
}

// figure "mimi" (the storefront): Mimi takes the place of the mark, with confetti when something worked and a warning
// sign when it did not. "icon" (the admin): the plain ✓ / ! mark.
const POPUP_FIGURES = {
  mimi: (isError) => <Mimi state={isError ? "warning" : "success"} celebrate={isError ? 0 : 1} className="popup-mimi" />,
  icon: (isError) => <span className={`popup-mark ${isError ? "is-error" : ""}`} aria-hidden="true">{isError ? "!" : "✓"}</span>,
};

export function AlertPopup({ alert, onClose, figure = "mimi" }) {
  useEffect(() => {
    if (!alert) return undefined;
    const onKey = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [alert, onClose]);
  if (!alert) return null;
  const isError = alert.type === "error";

  return (
    <div className="popup-backdrop" onClick={onClose}>
      <div className="popup-sign" role="alertdialog" aria-modal="true" aria-labelledby="popup-title" onClick={(event) => event.stopPropagation()}>
        <span className="popup-chains" aria-hidden="true" />
        {POPUP_FIGURES[figure](isError)}
        <p className="eyebrow">{isError ? "KHÔNG THỂ THỰC HIỆN" : "THAO TÁC THÀNH CÔNG"}</p>
        <h2 id="popup-title">{isError ? "Vui lòng kiểm tra lại" : "Đã hoàn tất"}</h2>
        <p>{alert.message}</p>
        <button type="button" className="btn btn-door" onClick={onClose} autoFocus>{isError ? "Đã hiểu" : "Tiếp tục"}</button>
      </div>
    </div>
  );
}
