import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { money } from "../api.js";
import { PRODUCT_STATUS_TONE } from "../content.js";
import { Mimi, MimiFace, PokableMimi } from "./Mimi.jsx";
import { PHONE_QUERY } from "./Shell.jsx";
import { ProductImage } from "./Cards.jsx";
import QuoteDraftCard from "./QuoteDraftCard.jsx";

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

// "Đề xuất N" on a card when an answer offers a choice, and on the newest answer a button that says "Tôi chọn đề xuất N"
// for the visitor, so they can pick by number instead of reading out a long product name.
export function SuggestionLabel({ number, onChoose }) {
  return (
    <span className="suggestion-label">
      <span className="suggestion-number">Đề xuất {number}</span>
      {onChoose && <button type="button" className="suggestion-choose" onClick={() => onChoose(number)}>Chọn đề xuất {number}</button>}
    </span>
  );
}

// N is the card's place in the answer, the order the reply names the products and the order the history sent back to
// the assistant lists them, so "đề xuất 2" means the same product to the visitor and to the assistant.
export const isChoice = (products) => products.length > 1;

// Only the newest answer can be chosen from: the assistant reads "đề xuất N" against its latest numbered list.
export function chooserFor(assistant, index) {
  const message = assistant.messages[index];
  const isNewest = index >= 0 && index === assistant.messages.length - 1;
  if (!isNewest || assistant.busy || !isChoice(message.products || [])) return undefined;
  // A tap answers instead of the mic, which may be listening on the Mimi screen.
  return (number) => {
    assistant.voice.cancel();
    assistant.send(`Tôi chọn đề xuất ${number}`);
  };
}

function ChatProduct({ product, number, onPick, onChoose }) {
  return (
    <li className="chat-product">
      <span className="chat-product-photo"><ProductImage path={product.image} alt="" label={product.category} /></span>
      <span className="chat-product-body">
        {number && <SuggestionLabel number={number} onChoose={onChoose} />}
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
export function ChatProducts({ message, onPick, onChoose }) {
  const numbered = isChoice(message.products);
  return (
    <>
      {message.suggested && <p className="chat-note">Gợi ý cho bạn</p>}
      <ul className="chat-products">
        {message.products.map((p, i) => <ChatProduct key={p.id} product={p} number={numbered ? i + 1 : null} onPick={onPick} onChoose={onChoose} />)}
      </ul>
    </>
  );
}

// A quote draft under an answer. Only the newest draft can be sent; one replaced by a later draft is shown as old.
export function MessageQuote({ assistant, index }) {
  const message = assistant.messages[index];
  const newest = assistant.messages.findLastIndex((m) => m.quoteDraft);
  return (
    <QuoteDraftCard
      draft={message.quoteDraft}
      sentId={message.quoteSent?.id}
      superseded={index !== newest}
      onSubmit={(form) => assistant.submitQuote(index, form)}
    />
  );
}

// While Mimi reads `text` aloud, only the part she has said so far ("" until the sound starts), so the words appear
// as she speaks them. When nothing is being read — reading off, speech failed or blocked, paused — the whole text.
export function spokenSoFar(assistant, text) {
  const { reading } = assistant.speaker;
  return reading?.text === text ? text.slice(0, reading.chars) : text;
}

// The greeting, first-question suggestions and the conversation. `renderProducts(message, index)` draws what goes
// under an answer that found products.
export function ChatThread({ assistant, listRef, renderProducts }) {
  const latest = assistant.messages.length - 1;
  return (
    <div className="chat-messages" ref={listRef} aria-live="polite">
      <AssistantSays>{GREETING}</AssistantSays>
      {!assistant.messages.length && (
        <div className="chat-suggestions">
          {SUGGESTIONS.map((s) => <button type="button" key={s} onClick={() => assistant.send(s)}>{s}</button>)}
        </div>
      )}
      {assistant.messages.map((m, i) => {
        const shown = i === latest ? spokenSoFar(assistant, m.content) : m.content;
        // Products and the quote draft follow once she has finished saying the answer.
        const finished = shown.length === m.content.length;
        return (
          <div key={i} className={`chat-turn is-${m.role}`}>
            {m.role === "assistant" ? <AssistantSays typing={!shown}>{shown}</AssistantSays> : <p className={`chat-bubble is-${m.role}`}>{m.content}</p>}
            {finished && m.products?.length > 0 && renderProducts(m, i)}
            {finished && m.quoteDraft && <MessageQuote assistant={assistant} index={i} />}
          </div>
        );
      })}
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
  }, [listRef, shown, assistant.messages.length, assistant.busy, assistant.speaker.reading?.chars]);
}

export function ReadAloudButton({ assistant }) {
  const { readAloud } = assistant;
  return (
    <button type="button" className="chat-head-icon" aria-pressed={readAloud} aria-label={readAloud ? "Tắt đọc câu trả lời" : "Bật đọc câu trả lời"} title={readAloud ? "Đang đọc to mọi câu trả lời" : "Không đọc câu trả lời"} onClick={assistant.toggleReadAloud}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" />{readAloud ? <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" /> : <path d="M16.5 9.5l5 5M21.5 9.5l-5 5" />}</svg>
    </button>
  );
}

// Browsers have no permission prompt for sound: the visitor's tap on this button is what lets the answer play.
export function BlockedSpeechPrompt({ assistant }) {
  if (!assistant.speaker.blockedText) return null;
  return (
    <div className="speech-blocked" role="alert">
      <p>Trình duyệt cần bạn cho phép một lần để Mimi đọc câu trả lời.</p>
      <button type="button" className="btn btn-door" onClick={assistant.playBlocked}>🔊 Cho phép &amp; nghe Mimi</button>
    </div>
  );
}

// Voice errors, the question box with the mic and send buttons, and the fine print.
export function ChatComposer({ assistant, inputRef }) {
  const { voice, voiceActive, speaker, busy, draft, send } = assistant;
  return (
    <>
      {(voice.error || speaker.problem) && <p className="chat-voice-error" role="alert">{voice.error || speaker.problem}</p>}
      <BlockedSpeechPrompt assistant={assistant} />
      <form className="chat-input" onSubmit={(event) => { event.preventDefault(); send(draft); }}>
        <label htmlFor="chat-question" className="visually-hidden">Câu hỏi cho trợ lý</label>
        <textarea
          id="chat-question"
          ref={inputRef}
          rows="2"
          maxLength={MAX_CHARS}
          value={voiceActive ? voice.heard : draft}
          readOnly={voiceActive}
          placeholder={voiceActive ? "Mình đang nghe, bạn cứ nói…" : "Ví dụ: giấy dán tường dưới 200k"}
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

// The header of both chat boxes, the floating panel and the assistant page, so they look the same. Only the panel
// passes `onExpand` and `onClose`: the page is already full size and is left by navigating.
export function AssistantHead({ assistant, onTalk, onExpand, onClose }) {
  return (
    <header className="chat-head">
      <MimiFace className="chat-head-mimi" />
      <button type="button" className="chat-head-action" onClick={onTalk} title="Mở màn hình nói chuyện trực tiếp với Mimi">🎤 Nói với Mimi</button>
      <ReadAloudButton assistant={assistant} />
      {onExpand && (
        <button type="button" className="chat-head-icon chat-expand" aria-label="Mở rộng toàn màn hình" title="Mở rộng toàn màn hình" onClick={onExpand}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" /></svg>
        </button>
      )}
      <button type="button" className="chat-head-action" onClick={assistant.restart} title="Bắt đầu cuộc trò chuyện mới" disabled={assistant.busy || !assistant.messages.length}>Làm mới</button>
      {onClose && <button type="button" className="chat-close" aria-label="Đóng trợ lý" onClick={onClose}>×</button>}
    </header>
  );
}

export default function ChatAssistant({ open, onOpenChange, onExpand, onTalk, assistant }) {
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
      <button type="button" className="chat-launcher" data-mimi-anchor aria-expanded={open} aria-controls="chat-panel" onClick={() => onOpenChange(!open)}>
        <Mimi className="chat-launcher-mimi" />
        <span>{open ? "Đóng" : "Trợ lý AI"}</span>
      </button>

      {/* Desktop only (hidden on phones by CSS): Mimi stands beside the panel and acts out the conversation. */}
      {open && <PokableMimi state={assistant.mimiState} onPoke={assistant.pokeMimi} className="chat-mimi-stand" />}

      {open && (
        <section className="chat-panel" id="chat-panel" role="dialog" aria-label="Trợ lý AI">
          <AssistantHead assistant={assistant} onTalk={onTalk} onExpand={onExpand} onClose={close} />
          <ChatThread assistant={assistant} listRef={listRef} renderProducts={(m, i) => <ChatProducts message={m} onPick={closeOnSmallScreen} onChoose={chooserFor(assistant, i)} />} />
          <ChatComposer assistant={assistant} inputRef={inputRef} />
        </section>
      )}
    </>
  );
}
