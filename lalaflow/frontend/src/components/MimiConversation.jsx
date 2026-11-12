import { useEffect, useRef, useState } from "react";
import { PokableMimi } from "./Mimi.jsx";
import { BlockedSpeechPrompt, ChatProducts, chooserFor, MessageQuote, spokenSoFar } from "./ChatAssistant.jsx";

export const MIMI_GREETING = "Chào bạn, mình là Mimi, trợ lý AI của LaLa Home. Mình có thể giúp gì cho bạn?";
// When the visitor comes back to the screen in the same visit she carries on instead of introducing herself again.
export const MIMI_WELCOME_BACK = "Mimi đây! Bạn cần mình giúp gì thêm nào?";
const RETURN_HINT_MS = 6000;
const HINT_WIDTH = 240;
const HINT_EDGE = 12;
const MAX_CHARS = 500;

// Where the greeting stands: being prepared, waiting for a tap because the browser blocked sound, or done.
const GREETING_STATES = { preparing: "preparing", needsTap: "needsTap", done: "done" };

function statusLine({ assistant, greeting }) {
  const { voice, busy, speaker, conversation } = assistant;
  if (greeting === GREETING_STATES.preparing) return "Mimi đang ra chào bạn…";
  if (greeting === GREETING_STATES.needsTap) return "Bấm nút bên dưới để nghe Mimi và trò chuyện bằng giọng nói.";
  if (busy) return "Mimi đang tìm câu trả lời…";
  if (speaker.speaking) return "Mimi đang nói…";
  if (speaker.preparing) return "Mimi chuẩn bị nói…";
  if (voice.state === "starting") return "Đang mở micro…";
  if (voice.state === "listening") return "Mimi đang nghe, bạn cứ nói tự nhiên nhé.";
  if (voice.state === "finishing") return "Mimi nghe rồi, đang gửi…";
  if (conversation.paused) return "Đã tạm dừng. Bấm micro khi muốn nói tiếp.";
  return assistant.micAvailable ? "Bấm micro để nói, hoặc gõ câu hỏi." : "Gõ câu hỏi cho Mimi bên dưới.";
}

// What Mimi said last and the visitor's words: live while they speak, otherwise their last question. Only messages
// since the screen opened count, so a conversation kept from earlier in the tab does not cover the greeting.
function latestTurn(assistant, earlier, greeting) {
  const { voice, voiceActive } = assistant;
  const messages = assistant.messages.slice(earlier);
  const reply = messages.findLast((m) => m.role !== "user");
  const question = messages.findLast((m) => m.role === "user");
  return {
    reply: reply || { role: "assistant", content: greeting },
    heard: voiceActive ? voice.heard : question?.content || "",
  };
}

function MicButton({ assistant }) {
  const { voiceActive, busy, speaker, conversation } = assistant;
  const live = voiceActive || speaker.speaking || speaker.preparing;
  const label = live ? "Tạm dừng" : "Bấm để nói";
  return (
    <button
      type="button"
      className={`mimi-talk-mic ${voiceActive ? "is-on" : ""}`}
      aria-label={live ? "Tạm dừng trò chuyện bằng giọng nói" : "Nói với Mimi"}
      onClick={live ? conversation.pause : conversation.resume}
      disabled={busy}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {live
          ? <path d="M9 6v12M15 6v12" />
          : <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" /></>}
      </svg>
      <span>{label}</span>
    </button>
  );
}

function TypedQuestion({ assistant }) {
  const { draft, setDraft, send, busy, voiceActive } = assistant;
  return (
    <form className="mimi-talk-type" onSubmit={(event) => { event.preventDefault(); send(draft); }}>
      <label htmlFor="mimi-talk-question" className="visually-hidden">Câu hỏi cho Mimi</label>
      <input
        id="mimi-talk-question"
        maxLength={MAX_CHARS}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="Hoặc gõ: giấy dán tường chống ẩm…"
        disabled={voiceActive}
        autoComplete="off"
      />
      <button type="submit" className="btn btn-door" disabled={busy || voiceActive || !draft.trim()}>Gửi</button>
    </form>
  );
}

// Mimi in the middle of the screen, talking with the visitor in turns: she greets, listens, answers aloud with
// products, then listens again (see `conversing` in useAssistantChat).
export default function MimiConversation({ assistant, onClose, onBrowse, onOpenChat, greetingText = MIMI_GREETING }) {
  const [greeting, setGreeting] = useState(GREETING_STATES.preparing);
  const { speaker, conversation, voice } = assistant;
  const closeRef = useRef(null);
  const [earlier] = useState(assistant.messages.length);

  async function greet() {
    const outcome = await conversation.speakThenListen(greetingText);
    setGreeting(outcome === "blocked" ? GREETING_STATES.needsTap : GREETING_STATES.done);
  }

  // The browser decides whether sound may start without a tap: desktop browsers usually allow it after the visitor
  // clicked Welcome on the cover, phones usually do not, and then the greeting waits for the button below.
  useEffect(() => {
    let cancelled = false;
    speaker.preload(greetingText).then(() => {
      if (!cancelled) greet();
    });
    return () => {
      cancelled = true;
    };
    // Runs once when the screen opens; greet() reads the latest assistant through its own closure.
  }, []);

  useEffect(() => {
    closeRef.current?.focus();
    const closeOnEscape = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const { reply, heard } = latestTurn(assistant, earlier, greetingText);
  const answered = assistant.messages.length > earlier;
  const waitingForTap = greeting === GREETING_STATES.needsTap;
  const problem = voice.error || (waitingForTap ? "" : speaker.problem);
  // Her words appear as she says them; until the greeting's sound is ready she shows the typing dots.
  const greetingOnItsWay = greeting === GREETING_STATES.preparing && !answered && !speaker.reading;
  const said = greetingOnItsWay ? "" : spokenSoFar(assistant, reply.content);
  const typing = assistant.busy || !said;
  const finished = !typing && said.length === reply.content.length;

  return (
    <div className={`mimi-talk ${answered ? "has-answer" : ""}`} role="dialog" aria-modal="true" aria-label="Trò chuyện với Mimi, trợ lý AI">
      <header className="mimi-talk-top">
        <button type="button" className="mimi-talk-link" onClick={onOpenChat} disabled={!assistant.messages.length}>Xem cả cuộc trò chuyện</button>
        <button type="button" ref={closeRef} className="mimi-talk-close" aria-label="Đóng, vào trang LalaFlow" onClick={onClose}>×</button>
      </header>

      <div className="mimi-talk-stage">
        <PokableMimi state={assistant.mimiState} onPoke={assistant.pokeMimi} className="mimi-talk-figure" />
        <div className="mimi-talk-lines" aria-live="polite">
          {typing
            ? <p className="mimi-talk-says is-typing" aria-label="Mimi đang trả lời"><span /><span /><span /></p>
            : <p className={`mimi-talk-says ${reply.role === "notice" ? "is-notice" : ""}`}>{said}</p>}
          {heard && <p className="mimi-talk-heard"><span>Bạn:</span> {heard}</p>}
        </div>
        {finished && reply.products?.length > 0 && (
          <div className="mimi-talk-products"><ChatProducts message={reply} onPick={onClose} onChoose={chooserFor(assistant, assistant.messages.indexOf(reply))} /></div>
        )}
        {finished && reply.quoteDraft && (
          <div className="mimi-talk-quote"><MessageQuote assistant={assistant} index={assistant.messages.indexOf(reply)} /></div>
        )}
      </div>

      <footer className="mimi-talk-controls">
        <p className="mimi-talk-status">{statusLine({ assistant, greeting })}</p>
        {problem && <p className="mimi-talk-problem" role="alert">{problem}</p>}
        {!waitingForTap && <BlockedSpeechPrompt assistant={assistant} />}
        {waitingForTap
          ? <button type="button" className="btn btn-door mimi-talk-start" onClick={() => { setGreeting(GREETING_STATES.preparing); greet(); }}>🎤 Nói chuyện với Mimi</button>
          : assistant.micAvailable && <MicButton assistant={assistant} />}
        <TypedQuestion assistant={assistant} />
        <button type="button" className="mimi-talk-browse" onClick={onBrowse}>Tự xem sản phẩm →</button>
      </footer>
    </div>
  );
}

// After the Mimi screen closes, a bubble points at the button that brings her back: the floating "Trợ lý AI" button
// on a computer, the "Trợ lý AI" tab on a phone (whichever carries data-mimi-anchor and is shown). It measures the
// button because the tab's position depends on how many tabs the shop shows.
export function MimiReturnHint({ onOpen, onDone }) {
  const [anchor, setAnchor] = useState(null);

  useEffect(() => {
    const target = [...document.querySelectorAll("[data-mimi-anchor]")].find((el) => el.getClientRects().length > 0);
    if (!target) {
      onDone();
      return undefined;
    }
    const box = target.getBoundingClientRect();
    const centre = box.left + box.width / 2;
    const width = Math.min(HINT_WIDTH, window.innerWidth - 2 * HINT_EDGE);
    const left = Math.min(Math.max(HINT_EDGE, centre - width / 2), window.innerWidth - width - HINT_EDGE);
    setAnchor({ left, width, tip: centre - left, bottom: window.innerHeight - box.top + 12 });
    const timer = setTimeout(onDone, RETURN_HINT_MS);
    return () => clearTimeout(timer);
  }, [onDone]);

  if (!anchor) return null;
  return (
    <button type="button" className="mimi-return-hint" style={{ left: anchor.left, width: anchor.width, bottom: anchor.bottom, "--tip": `${anchor.tip}px` }} onClick={onOpen}>
      Mimi ở đây nè! Bấm để nói chuyện tiếp 🎤
    </button>
  );
}
