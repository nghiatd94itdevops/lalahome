import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, useNavigate, useParams } from "react-router-dom";
import { AlertPopup } from "../components/Shell.jsx";
import { canAccess, isAdmin, request, session, setUnauthorizedHandler } from "./client.js";
import { ALL_ITEMS, visibleMenu } from "./menu.js";
import { AdminContext, ConfirmDialog } from "./ui.jsx";
import { SCREENS } from "./screens/index.js";
import Later from "./screens/Later.jsx";
import ErrorBoundary from "../components/ErrorBoundary.jsx";

const ROLE_LABELS = { admin: "Quản trị viên", sales: "Sale", warehouse: "Kho", accounting: "Kế toán", content: "Nội dung", staff: "Tùy chỉnh" };

function LoginScreen({ onLogin }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await request("/auth/login", { method: "POST", body: form });
      session.save(data.token, data.user);
      onLogin(data.user);
    } catch (loginError) {
      setError(loginError.message === "Invalid credentials" ? "Email hoặc mật khẩu không đúng." : loginError.message || "Đăng nhập thất bại");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-theme login-scene">
      <form className="login-card" onSubmit={submit}>
        <span className="login-logo" aria-hidden="true">L</span>
        <p className="eyebrow">TRANG QUẢN TRỊ</p>
        <h1>Chào mừng trở lại</h1>
        <p className="muted">Đăng nhập để quản lý nội dung LalaFlow.</p>
        <label className="field">
          <span className="field-label">Email</span>
          <input id="login-email" type="email" autoComplete="username" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        </label>
        <label className="field">
          <span className="field-label">Mật khẩu</span>
          <input id="login-password" type="password" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className="btn btn-door btn-large" disabled={busy}>{busy ? "Đang đăng nhập…" : "Đăng nhập"}</button>
        <Link to="/" className="text-link">← Về trang khách hàng</Link>
      </form>
    </div>
  );
}

function useAlerts(user) {
  const [counts, setCounts] = useState({ quotes: 0, inventory: 0, orders: 0 });
  const refresh = useCallback(async () => {
    const next = { quotes: 0, inventory: 0, orders: 0 };
    const jobs = [];
    if (canAccess(user, "quote_requests.manage")) {
      jobs.push(request("/quote-requests").then((rows) => { next.quotes = rows.filter((row) => row.status === "Mới").length; }));
    }
    if (isAdmin(user)) {
      jobs.push(request("/correction-requests").then((rows) => {
        const pending = rows.filter((row) => row.status === "pending");
        next.inventory = pending.filter((row) => row.record_type === "inventory").length;
        next.orders = pending.filter((row) => row.record_type === "order").length;
      }));
    }
    const results = await Promise.allSettled(jobs);
    results.filter((result) => result.status === "rejected").forEach((result) => console.warn(`Notification count failed: ${result.reason?.message}`));
    setCounts(next);
  }, [user]);
  return { counts, refresh };
}

function Bell({ counts, onOpen }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const total = counts.quotes + counts.inventory + counts.orders;
  useEffect(() => {
    const close = (event) => box.current && !box.current.contains(event.target) && setOpen(false);
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  const items = [
    counts.quotes && { tab: "quote_requests", mark: "BG", title: "Yêu cầu báo giá mới", text: `${counts.quotes} khách hàng đang chờ phản hồi` },
    counts.inventory && { tab: "inventory_corrections", mark: "!", title: "Sai sót nhập / xuất kho", text: `${counts.inventory} yêu cầu chờ Admin duyệt` },
    counts.orders && { tab: "orders_corrections", mark: "!", title: "Sai sót đơn hàng", text: `${counts.orders} yêu cầu chờ Admin duyệt` },
  ].filter(Boolean);

  return (
    <div className="bell-box" ref={box}>
      <button type="button" className={`bell ${total ? "has-alerts" : ""}`} aria-expanded={open} aria-label={`Thông báo, ${total} việc chưa xử lý`} onClick={() => setOpen(!open)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>
        {total > 0 && <span className="bell-count">{total > 99 ? "99+" : total}</span>}
      </button>
      {open && (
        <div className="bell-panel" role="dialog" aria-label="Thông báo">
          <p className="bell-title">Thông báo <span>{total ? `${total} việc chưa xử lý` : "Không có việc mới"}</span></p>
          {items.length ? (
            items.map((item) => (
              <button key={item.tab} type="button" className="bell-item" onClick={() => { setOpen(false); onOpen(item.tab); }}>
                <span className="bell-mark">{item.mark}</span>
                <span><strong>{item.title}</strong>{item.text}</span>
              </button>
            ))
          ) : (
            <p className="bell-empty">✓ Mọi việc đã được xử lý<br /><span>Thông báo mới sẽ xuất hiện tại đây.</span></p>
          )}
        </div>
      )}
    </div>
  );
}

function Workspace({ user, onLogout }) {
  const { tab = "home" } = useParams();
  const navigate = useNavigate();
  const [alert, setAlert] = useState(null);
  const [confirmRequest, setConfirmRequest] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState({});
  const { counts, refresh } = useAlerts(user);

  const allowed = useCallback((item) => {
    if (item.adminOnly) return isAdmin(user);
    return (!item.perm || canAccess(user, item.perm)) && (item.needs || []).every((permission) => canAccess(user, permission));
  }, [user]);
  const menu = useMemo(() => visibleMenu(allowed), [allowed]);
  const item = ALL_ITEMS.find((entry) => entry.tab === tab);

  useEffect(() => {
    refresh();
    setMenuOpen(false);
  }, [tab, refresh]);

  const notify = useCallback((type, message) => setAlert({ type, message }), []);
  const confirm = useCallback((options) => new Promise((resolve) => setConfirmRequest({ ...options, resolve })), []);
  const answer = (value) => {
    confirmRequest?.resolve(value);
    setConfirmRequest(null);
  };
  const goTo = useCallback((nextTab, query = "") => navigate(`/admin/${nextTab}${query}`), [navigate]);
  const context = useMemo(() => ({ user, notify, confirm, goTo, refreshAlerts: refresh }), [user, notify, confirm, goTo, refresh]);

  let body;
  if (!item || !allowed(item)) body = <Later title="Không mở được màn hình này" text="Màn hình không tồn tại hoặc tài khoản của bạn chưa được cấp quyền." />;
  else if (!SCREENS[tab]) body = <Later title={item.title} />;
  else {
    const Screen = SCREENS[tab];
    body = <Screen key={tab} tab={tab} />;
  }

  return (
    <AdminContext.Provider value={context}>
      <div className="admin-theme">
      <div className="admin">
        <aside className={`admin-side ${menuOpen ? "is-open" : ""}`}>
          <Link to="/admin/home" className="side-brand">
            <span className="side-logo" aria-hidden="true">L</span>
            <span>LalaFlow<small>Paper CMS</small></span>
          </Link>
          <p className="side-caption">MENU QUẢN TRỊ</p>
          <nav aria-label="Menu quản trị">
            {menu.map((entry) =>
              entry.items ? (
                <div key={entry.group} className="side-group">
                  <button type="button" className="side-group-title" aria-expanded={!collapsed[entry.group]} onClick={() => setCollapsed({ ...collapsed, [entry.group]: !collapsed[entry.group] })}>
                    {entry.group}<span aria-hidden="true">{collapsed[entry.group] ? "+" : "–"}</span>
                  </button>
                  {!collapsed[entry.group] && entry.items.map((link) => (
                    <NavLink key={link.tab} to={`/admin/${link.tab}`} className="side-link">
                      {link.label}
                    </NavLink>
                  ))}
                </div>
              ) : (
                <NavLink key={entry.tab} to={`/admin/${entry.tab}`} className="side-link side-link-top">{entry.label}</NavLink>
              ),
            )}
          </nav>
          <div className="side-user">
            <span className="avatar" aria-hidden="true">{(user.name || user.email || "?").charAt(0).toUpperCase()}</span>
            <span><strong>{user.name}</strong>{user.groupName || user.email}</span>
            <button type="button" className="link-button" onClick={onLogout}>Đăng xuất</button>
          </div>
        </aside>

        <div className="admin-main">
          <header className="admin-head">
            <button type="button" className="menu-toggle admin-menu-toggle" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>Menu</button>
            <div>
              <p className="eyebrow">LALAFLOW CMS</p>
              <h1>{item?.title || "LalaFlow"}</h1>
            </div>
            <div className="head-actions">
              <Bell counts={counts} onOpen={goTo} />
              <span className="user-chip">{user.name} · {ROLE_LABELS[user.role] || user.role}</span>
              <Link to="/" className="btn btn-paper btn-small">Xem website</Link>
            </div>
          </header>
          <div className="admin-body"><ErrorBoundary resetKey={tab}>{body}</ErrorBoundary></div>
        </div>
      </div>
      <AlertPopup alert={alert} onClose={() => setAlert(null)} figure="icon" />
      <ConfirmDialog request={confirmRequest} onAnswer={answer} />
      </div>
    </AdminContext.Provider>
  );
}

export default function AdminApp() {
  const [user, setUser] = useState(() => (session.token() ? session.user() : null));
  const navigate = useNavigate();

  const logout = useCallback(() => {
    session.clear();
    setUser(null);
    navigate("/admin");
  }, [navigate]);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    if (!session.token()) return;
    request("/auth/me")
      .then((fresh) => {
        session.save(session.token(), fresh);
        setUser(fresh);
      })
      .catch((error) => {
        console.warn(`Session check failed, signing out: ${error.message}`);
        logout();
      });
  }, [logout]);

  useEffect(() => {
    document.title = "Quản trị | LalaFlow";
    let robots = document.head.querySelector('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement("meta");
      robots.name = "robots";
      document.head.appendChild(robots);
    }
    robots.content = "noindex,nofollow";
  }, []);

  if (!user) return <LoginScreen onLogin={(loggedIn) => { setUser(loggedIn); navigate("/admin/home"); }} />;
  return <Workspace user={user} onLogout={logout} />;
}
