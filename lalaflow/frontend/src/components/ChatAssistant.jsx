import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { money } from "../api.js";
import { PRODUCT_STATUS_TONE } from "../content.js";
import { Mimi, MimiFace } from "./Mimi.jsx";
import { ProductImage } from "./Cards.jsx";
import { PHONE_QUERY } from "./Shell.jsx";

const MAX_CHARS = 500;
const SUGGESTIONS = ["Giấy dán tường chống nước, chống cháy", "Giấy in A4 giá tốt", "Giấy làm bao bì dưới 300k"];
const GREETING = "Chào bạn! Mình là trợ lý của LalaFlow. Bạn cần loại giấy gì, dùng vào việc gì, giá khoảng bao nhiêu? Gõ hoặc bấm micro để nói, mình sẽ tìm sản phẩm phù hợp cho bạn.";

// An assistant message with Mimi's face beside it, as in a messaging app.
function AssistantSays({ children, typing = false }) {
  return (
    <div className="chat-says">
      <MimiFace className="chat-avatar" />
      {typing
        ? <p className="chat-bubble is-assistant is-typing" aria-label="Trợ lý đang trả lời"><span /><span /><span /></p>
        : <p className="chat-bubble is-assistant">{children}</p>}
    </div>
  );
}

function ChatProduct({ product, onPick }) {
  return (
    <li className="chat-product">
      <span className="chat-product-photo"><ProductImage path={product.image} alt="" label={product.category} /></span>
      <span className="chat-product-body">
        <strong>{product.name}</strong>
        <span className="chat-product-price">{money(product.price)}<small>/{product.unit}</small></span>
        <span className={`chat-product-stock tone-${PRODUCT_STATUS_TONE[product.status] || "wait"}`}>{product.status}</span>
        <span className="chat-product-links">
          <Link to={`/san-pham/${product.id}`} onClick={onPick}>Xem chi tiết</Link>
          <Link to={`/yeu-cau-bao-gia?product=${product.id}`} onClick={onPick}>Báo giá</Link>
        </span>
      </span>
    </li>
  );
}

// The products under an answer, as compact rows in the conversation.
export function ChatProducts({ message, onPick }) {
  return (
    <>
      {message.suggested && <p className="chat-note">Gợi ý cho bạn</p>}
      <ul className="chat-products">{message.products.map((p) => <ChatProduct key={p.id} product={p} onPick={onPick} />)}</ul>
    </>
  );
}

// The greeting, first-question suggestions and the conversation. `renderProducts(message, index)` draws what goes
// under an answer that found products.
export function ChatThread({ assistant, listRef, renderProducts }) {
  return (
    <div className="chat-messages" ref={listRef} aria-live="polite">
      <AssistantSays>{GREETING}</AssistantSays>
      {!assistant.messages.length && (
        <div className="chat-suggestions">
          {SUGGESTIONS.map((s) => <button type="button" key={s} onClick={() => assistant.send(s)}>{s}</button>)}
        </div>
      )}
      {assistant.messages.map((m, i) => (
        <div key={i} className={`chat-turn is-${m.role}`}>
          {m.role === "assistant" ? <AssistantSays>{m.content}</AssistantSays> : <p className={`chat-bubble is-${m.role}`}>{m.content}</p>}
          {m.products?.length > 0 && renderProducts(m, i)}
        </div>
      ))}
      {assistant.busy && <AssistantSays typing />}
    </div>
  );
}

// Keeps the newest message in view as the conversation grows.
export function useFollowLatest(listRef, assistant, shown) {
  useEffect(() => {
    if (!shown) return;
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [listRef, shown, assistant.messages.length, assistant.busy]);
}

export function ReadAloudButton({ assistant }) {
  const { readAloud } = assistant;
  return (
    <button type="button" className="chat-head-icon" aria-pressed={readAloud} aria-label={readAloud ? "Tắt đọc câu trả lời" : "Bật đọc câu trả lời"} title={readAloud ? "Đang đọc to mọi câu trả lời" : "Không đọc câu trả lời"} onClick={assistant.toggleReadAloud}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" />{readAloud ? <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" /> : <path d="M16.5 9.5l5 5M21.5 9.5l-5 5" />}</svg>
    </button>
  );
}

// Voice errors, the question box with the mic and send buttons, and the fine print.
export function ChatComposer({ assistant, inputRef }) {
  const { voice, voiceActive, speaker, busy, draft, send } = assistant;
  return (
    <>
      {(voice.error || speaker.problem) && <p className="chat-voice-error" role="alert">{voice.error || speaker.problem}</p>}
      <form className="chat-input" onSubmit={(event) => { event.preventDefault(); send(draft); }}>
        <label htmlFor="chat-question" className="visually-hidden">Câu hỏi cho trợ lý</label>
        <textarea
          id="chat-question"
          ref={inputRef}
          rows="2"
          maxLength={MAX_CHARS}
          value={voiceActive ? voice.heard : draft}
          readOnly={voiceActive}
          placeholder={voiceActive ? "Mình đang nghe, bạn cứ nói…" : "Ví dụ: giấy dán tường chống nước, giá dưới 200k"}
          onChange={(event) => assistant.setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.shiftKey) return;
            event.preventDefault();
            send(draft);
          }}
        />
        {assistant.micAvailable && (
          <button type="button" className={`chat-mic ${voiceActive ? "is-on" : ""}`} data-state={voice.state} aria-pressed={voiceActive} aria-label={voiceActive ? "Dừng nói" : "Hỏi bằng giọng nói"} onClick={assistant.toggleMic} disabled={busy || voice.state === "starting" || voice.state === "finishing"}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" /></svg>
          </button>
        )}
        <button type="submit" className="btn btn-door" disabled={busy || voiceActive || !draft.trim()}>Gửi</button>
      </form>
      <p className="chat-fineprint">Trợ lý AI có thể nhầm, giá và tồn kho chính xác xem ở trang sản phẩm.</p>
    </>
  );
}

export default function ChatAssistant({ open, onOpenChange, onExpand, assistant }) {
  const listRef = useRef(null);
  const inputRef = useRef(null);
  useFollowLatest(listRef, assistant, open);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open, assistant.messages.length, assistant.busy]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  function close() {
    onOpenChange(false);
  }

  const closeOnSmallScreen = () => {
    if (window.matchMedia(PHONE_QUERY).matches) close();
  };

  return (
    <>
      <button type="button" className="chat-launcher" aria-expanded={open} aria-controls="chat-panel" onClick={() => onOpenChange(!open)}>
        <Mimi className="chat-launcher-mimi" />
        <span>{open ? "Đóng" : "Trợ lý AI"}</span>
      </button>

      {/* Desktop only (hidden on phones by CSS): Mimi stands beside the panel and acts out the conversation. */}
      {open && <Mimi state={assistant.mimiState} className="chat-mimi-stand" />}

      {open && (
        <section className="chat-panel" id="chat-panel" role="dialog" aria-label="Trợ lý AI">
          <header className="chat-head">
            <MimiFace className="chat-head-mimi" />
            <div className="chat-head-text">
              <strong>Trợ lý AI</strong>
            </div>
            <ReadAloudButton assistant={assistant} />
            <button type="button" className="chat-head-icon chat-expand" aria-label="Mở rộng toàn màn hình" title="Mở rộng toàn màn hình" onClick={onExpand}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" /></svg>
            </button>
            <button type="button" className="chat-head-action" onClick={assistant.restart} title="Bắt đầu cuộc trò chuyện mới" disabled={assistant.busy || !assistant.messages.length}>Làm mới</button>
            <button type="button" className="chat-close" aria-label="Đóng trợ lý" onClick={close}>×</button>
          </header>
          <ChatThread assistant={assistant} listRef={listRef} renderProducts={(m) => <ChatProducts message={m} onPick={closeOnSmallScreen} />} />
          <ChatComposer assistant={assistant} inputRef={inputRef} />
        </section>
      )}
    </>
  );
}
