import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { canAccess, isAdmin } from "./client.js";
import { downloadWorkbook } from "./excel.js";

export const AdminContext = createContext(null);

export function useAdmin() {
  const context = useContext(AdminContext);
  const { user, notify } = context;
  return {
    ...context,
    can: (permission) => canAccess(user, permission),
    admin: isAdmin(user),
    // Runs an API action, shows the result popup and returns true on success.
    run: async (action, successMessage) => {
      try {
        await action();
        if (successMessage) notify("success", successMessage);
        return true;
      } catch (error) {
        notify("error", error.message || "Có lỗi xảy ra, vui lòng thử lại.");
        return false;
      }
    },
    exportExcel: async (fileName, sheets) => {
      if (!sheets.some((sheet) => sheet.rows?.length)) return notify("error", "Không có dữ liệu để xuất Excel.");
      try {
        await downloadWorkbook(fileName, sheets);
        notify("success", `Đã xuất file ${fileName}`);
      } catch (error) {
        notify("error", `Không thể xuất Excel: ${error.message}`);
      }
    },
  };
}

export function Panel({ title, subtitle, actions, children, className = "" }) {
  return (
    <section className={`panel ${className}`}>
      {(title || actions) && (
        <header className="panel-head">
          <div>
            {title && <h2>{title}</h2>}
            {subtitle && <p>{subtitle}</p>}
          </div>
          {actions && <div className="panel-actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Field({ label, hint, wide, children }) {
  return (
    <label className={`field ${wide ? "field-wide" : ""}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export const digitsOnly = (value) => String(value ?? "").replace(/\D/g, "");
export const formatThousands = (value) => {
  const digits = digitsOnly(value);
  return digits ? Number(digits).toLocaleString("vi-VN") : "";
};

// Shows 1.250.000 while keeping the raw digits in state.
export function MoneyInput({ value, onChange, ...rest }) {
  return (
    <input
      {...rest}
      inputMode="numeric"
      value={formatThousands(value)}
      onChange={(event) => onChange(digitsOnly(event.target.value))}
    />
  );
}

export function Metric({ label, value, note, tone }) {
  return (
    <div className={`metric ${tone ? `metric-${tone}` : ""}`}>
      <span className="metric-label">{label}</span>
      <strong>{value}</strong>
      {note && <span className="metric-note">{note}</span>}
    </div>
  );
}

export function Badge({ tone = "neutral", children }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export const ActiveBadge = ({ active }) => <Badge tone={active ? "ok" : "off"}>{active ? "Active" : "Inactive"}</Badge>;

export function LoadState({ resource, empty, children }) {
  if (resource.status === "loading") return <p className="load-note">Đang tải dữ liệu…</p>;
  if (resource.status === "error") {
    return (
      <p className="load-note is-error">
        Không tải được dữ liệu: {resource.error}{" "}
        <button type="button" className="link-button" onClick={resource.reload}>Thử lại</button>
      </p>
    );
  }
  if (empty) return <p className="load-note">{empty}</p>;
  return children;
}

const PAGE_SIZES = [10, 20, 50, 100];

// Client-side filter + paging; the page resets whenever any filter value changes.
export function usePaged(rows, filterKey, initialSize = 10) {
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(initialSize);
  useEffect(() => {
    setPage(1);
  }, [filterKey, size]);
  const pageCount = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(page, pageCount);
  const visible = useMemo(() => rows.slice((current - 1) * size, current * size), [rows, current, size]);
  return { visible, page: current, pageCount, size, setSize, setPage, total: rows.length };
}

export function Pagination({ paged }) {
  const { page, pageCount, size, setSize, setPage, total } = paged;
  if (!total) return null;
  const from = (page - 1) * size + 1;
  const to = Math.min(page * size, total);
  return (
    <div className="pagination">
      <span>Hiển thị <strong>{from}–{to}</strong> trong <strong>{total}</strong> kết quả</span>
      <label>
        Số dòng
        <select value={size} onChange={(event) => setSize(Number(event.target.value))}>
          {PAGE_SIZES.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
      <div className="pager">
        <button type="button" onClick={() => setPage(page - 1)} disabled={page <= 1} aria-label="Trang trước">‹</button>
        <span>Trang {page} / {pageCount}</span>
        <button type="button" onClick={() => setPage(page + 1)} disabled={page >= pageCount} aria-label="Trang sau">›</button>
      </div>
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder }) {
  return (
    <label className="filter-search">
      <span className="visually-hidden">Tìm kiếm</span>
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
      <input type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  );
}

export const distinct = (rows, pick) => [...new Set(rows.map(pick).filter(Boolean))];

export const includesText = (needle, ...fields) => {
  const query = needle.trim().toLowerCase();
  if (!query) return true;
  return fields.some((field) => String(field ?? "").toLowerCase().includes(query));
};

export function ConfirmDialog({ request, onAnswer }) {
  if (!request) return null;
  return (
    <div className="popup-backdrop" onClick={() => onAnswer(false)}>
      <div className="popup-sign" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" onClick={(event) => event.stopPropagation()}>
        <span className="popup-chains" aria-hidden="true" />
        <span className="popup-mark is-ask" aria-hidden="true">?</span>
        <h2 id="confirm-title">{request.title}</h2>
        <p>{request.message}</p>
        <div className="popup-actions">
          <button type="button" className="btn btn-paper" onClick={() => onAnswer(false)}>{request.cancelLabel || "Hủy"}</button>
          <button type="button" className="btn btn-door" onClick={() => onAnswer(true)} autoFocus>{request.confirmLabel || "Đồng ý"}</button>
        </div>
      </div>
    </div>
  );
}
