import { useState } from "react";
import { useApi } from "../client.js";
import { excelDate } from "../excel.js";
import { Badge, LoadState, Metric, Pagination, Panel, SearchBox, useAdmin, usePaged } from "../ui.jsx";

const BLOCK_LABEL = {
  credentials: "đăng nhập / tài khoản",
  secrets: "khoá bí mật",
  infrastructure: "hệ thống / máy chủ",
  internal: "dữ liệu nội bộ",
  override: "lách quy tắc",
  reply_leak: "câu trả lời bị giữ lại",
};

const parsedSearches = (log) => {
  try {
    return JSON.parse(log.searches || "[]");
  } catch {
    return [];
  }
};
// Blocked turns store {"blocked": topic} instead of the list of searches.
const blockedTopic = (log) => parsedSearches(log).blocked || "";

const searchedFor = (log) => {
  const searches = parsedSearches(log);
  const list = Array.isArray(searches) ? searches : searches.searches || [];
  try {
    return list.map((s) => [(s.keywords || []).join(", "), s.max_price ? `≤ ${Number(s.max_price).toLocaleString("vi-VN")}đ` : ""].filter(Boolean).join(" ")).join(" | ");
  } catch {
    return "";
  }
};

export function ChatLogs() {
  const { exportExcel } = useAdmin();
  const list = useApi("/chat-logs");
  const [filters, setFilters] = useState({ query: "", outcome: "" });
  const all = list.data || [];
  const matchesOutcome = (l) => !filters.outcome
    || (filters.outcome === "error" && l.error)
    || (filters.outcome === "blocked" && blockedTopic(l))
    || (filters.outcome === "products" && l.product_ids)
    || (filters.outcome === "none" && !l.error && !l.product_ids);
  const query = filters.query.trim().toLowerCase();
  const rows = all.filter((l) => matchesOutcome(l) && (!query || `${l.question} ${l.answer || ""}`.toLowerCase().includes(query)));
  const paged = usePaged(rows, JSON.stringify(filters), 20);
  const sessions = new Set(all.map((l) => l.session_id)).size;
  const tokens = all.reduce((sum, l) => sum + l.prompt_tokens + l.completion_tokens, 0);

  const exportLogs = () => exportExcel("hoi-thoai-ai.xlsx", [{
    name: "Hội thoại AI", rows: all,
    columns: [
      { header: "Thời gian", value: (r) => excelDate(r.created_at), width: 22 }, { header: "Phiên", key: "session_id", width: 38 },
      { header: "Khách hỏi", key: "question", width: 50 }, { header: "Trợ lý trả lời", key: "answer", width: 70 },
      { header: "Sản phẩm gợi ý", key: "product_ids", width: 18 }, { header: "Từ khoá tìm", value: searchedFor, width: 40 },
      { header: "Token vào", key: "prompt_tokens", width: 12, number: true }, { header: "Token ra", key: "completion_tokens", width: 12, number: true },
      { header: "Lỗi", key: "error", width: 40 },
    ],
  }]);

  return (
    <div className="stack">
      <div className="metric-grid">
        <Metric label="Câu hỏi" value={all.length} note="500 câu gần nhất" />
        <Metric label="Phiên trò chuyện" value={sessions} />
        <Metric label="Token đã dùng" value={tokens.toLocaleString("vi-VN")} note="Tra giá theo model trên trang OpenAI" />
      </div>
      <Panel title="Hội thoại với trợ lý AI" subtitle="Khách hỏi gì, trợ lý gợi ý sản phẩm nào — dùng để bổ sung mô tả và nhập thêm hàng." actions={<button type="button" className="btn btn-paper btn-small" onClick={exportLogs}>Xuất Excel</button>}>
        <div className="filters">
          <SearchBox value={filters.query} onChange={(value) => setFilters({ ...filters, query: value })} placeholder="Tìm trong câu hỏi hoặc câu trả lời..." />
          <select aria-label="Kết quả" value={filters.outcome} onChange={(e) => setFilters({ ...filters, outcome: e.target.value })}>
            <option value="">Tất cả câu hỏi</option>
            <option value="products">Có gợi ý sản phẩm</option>
            <option value="none">Không gợi ý sản phẩm</option>
            <option value="error">Bị lỗi</option>
            <option value="blocked">Bị chặn (bảo mật)</option>
          </select>
        </div>
        <LoadState resource={list} empty={list.data && !rows.length ? "Chưa có cuộc trò chuyện nào." : ""}>
          <div className="table-wrap">
            <table className="ledger-table">
              <thead><tr><th>Thời gian</th><th>Khách hỏi</th><th>Trợ lý trả lời</th><th>Sản phẩm</th><th className="num">Token</th></tr></thead>
              <tbody>
                {paged.visible.map((l) => (
                  <tr key={l.id}>
                    <td>{new Date(l.created_at).toLocaleString("vi-VN")}<span className="muted-line">Phiên {l.session_id.slice(0, 8)}</span></td>
                    <td>{l.question}{searchedFor(l) && <span className="muted-line">Tìm: {searchedFor(l)}</span>}</td>
                    <td>{l.error ? <Badge tone="bad">Lỗi</Badge> : blockedTopic(l) ? <><Badge tone="bad">Bị chặn · {BLOCK_LABEL[blockedTopic(l)] || blockedTopic(l)}</Badge><span className="muted-line">{l.answer}</span></> : l.answer}</td>
                    <td>{l.product_ids ? l.product_ids.split(",").map((id) => `#${id}`).join(", ") : "—"}</td>
                    <td className="num">{(l.prompt_tokens + l.completion_tokens).toLocaleString("vi-VN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination paged={paged} />
        </LoadState>
      </Panel>
    </div>
  );
}
