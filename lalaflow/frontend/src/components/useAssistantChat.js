// The assistant's conversation, shared by the floating panel and the full-page view so moving between them keeps
// the same chat, voice and Mimi mood.
import { useEffect, useRef, useState } from "react";
import { postJson } from "../api.js";
import { canListen, useSpeaker, useVoiceInput } from "./useVoice.js";

// Mimi's moments (states of the brand kit) last this long before she goes back to what the chat is doing.
const MOMENT_MS = 3000;
// While an answer is on its way she first thinks, then searches the catalogue (the assistant's tool call).
const THINK_BEFORE_SEARCH_MS = 1500;
// No typing, speaking or answer for this long while the assistant is shown: she dozes off.
const DOZE_AFTER_MS = 60000;
const THANKS = /c[aả]m [oơ]n|c[aá]m [oơ]n|thank/i;
// Same shape the backend keeps (lalaflow/backend/chat.js): the latest messages whole, and before them only the
// visitor's own questions, which hold the name, phone and email they gave earlier.
const RECENT_MESSAGES = 10;
const EARLIER_QUESTIONS = 20;
const STORAGE_KEY = "lalaflow.chat";

const newSessionId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);

// Per-tab memory so a reload keeps the conversation; storage can be unavailable (private mode), so it is optional.
function loadSaved() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null");
    if (saved?.sessionId && Array.isArray(saved.messages)) return saved;
  } catch {
    // unreadable or blocked storage: start a fresh conversation
  }
  return { sessionId: newSessionId(), messages: [] };
}

function save(state) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage full or blocked: the conversation still works for this page view
  }
}

// The assistant's earlier picks travel back as [#id] markers so a follow-up like "cái đó còn hàng không?" can be
// looked up again instead of guessed; a quote draft travels back with whether the visitor sent it, so the model
// never claims a draft went out.
function toApiMessage(m) {
  if (m.role !== "assistant") return { role: m.role, content: m.content };
  const notes = [m.content];
  // Numbered like the cards, so "tôi chọn đề xuất 2" can be resolved to the second card.
  if (m.products?.length) notes.push(`Sản phẩm đã giới thiệu: ${m.products.map((p, i) => `Đề xuất ${i + 1}: ${p.name} [#${p.id}]`).join("; ")}`);
  if (m.quoteDraft) {
    const lines = m.quoteDraft.items.map((item) => `${item.name} [#${item.productId}] × ${item.quantity} ${item.unit}`).join(", ");
    notes.push(`Phiếu báo giá nháp: ${lines}. ${m.quoteSent ? `Khách ĐÃ GỬI phiếu này (mã yêu cầu #${m.quoteSent.id}).` : "Khách CHƯA gửi phiếu này."}`);
  }
  return { role: "assistant", content: notes.join("\n") };
}

function historyForApi(messages) {
  const conversation = messages.filter((m) => m.role !== "notice");
  const earlier = conversation.slice(0, -RECENT_MESSAGES).filter((m) => m.role === "user").slice(-EARLIER_QUESTIONS);
  return [...earlier, ...conversation.slice(-RECENT_MESSAGES)].map(toApiMessage);
}

// Mimi's reaction to an answer: thanked → love, nothing found → sad, only suggestions → wink, a match → happy.
function answerMoment({ ok, products, suggested, question }) {
  if (!ok) return "error";
  if (THANKS.test(question)) return "love";
  if (!products.length) return "sad";
  return suggested ? "wink" : "happy";
}

// What Mimi shows: a short moment (greeting, a reaction to the answer) wins for MOMENT_MS, otherwise the chat's
// current activity.
function useMimiMood({ active, busy, listening, speaking }) {
  const [moment, setMoment] = useState(null);
  const [searching, setSearching] = useState(false);
  const [dozing, setDozing] = useState(false);
  const flash = (state) => setMoment({ state, at: Date.now() });

  useEffect(() => {
    if (active) flash("greet");
  }, [active]);

  useEffect(() => {
    if (!moment) return undefined;
    const timer = setTimeout(() => setMoment(null), MOMENT_MS);
    return () => clearTimeout(timer);
  }, [moment]);

  useEffect(() => {
    setSearching(false);
    if (!busy) return undefined;
    const timer = setTimeout(() => setSearching(true), THINK_BEFORE_SEARCH_MS);
    return () => clearTimeout(timer);
  }, [busy]);

  useEffect(() => {
    setDozing(false);
    if (!active || busy || listening || speaking) return undefined;
    const timer = setTimeout(() => setDozing(true), DOZE_AFTER_MS);
    return () => clearTimeout(timer);
  }, [active, busy, listening, speaking, moment]);

  let state = "idle";
  if (dozing) state = "sleep";
  if (listening) state = "listening";
  if (moment) state = moment.state;
  // Her voice starts while the reaction to the answer is still showing; a moving mouth matters more than the pose.
  if (speaking) state = "talking";
  if (busy) state = searching ? "searching" : "thinking";
  return { state, flash };
}

// `active`: the panel is open or the full page is shown. When it goes false the mic and speech stop, dropping a
// half-spoken question instead of sending it.
// `conversing`: the face-to-face Mimi screen is open. Every answer is read aloud and, unless the visitor paused,
// the mic opens again as soon as Mimi finishes speaking, so the visitor can just talk back.
export function useAssistantChat({ active, conversing = false }) {
  const [chat, setChat] = useState(loadSaved);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  // Off until the visitor turns it on, or asks by voice (then answers are read too, unless they switched it off).
  const [readAloud, setReadAloud] = useState(false);
  const readAloudChosen = useRef(false);
  const speaker = useSpeaker();
  const voice = useVoiceInput((question) => send(question, { spoken: true }));
  const voiceActive = voice.state !== "idle";
  const mood = useMimiMood({ active, busy, listening: voiceActive || draft.trim().length > 0, speaking: speaker.speaking });
  const [paused, setPaused] = useState(false);
  // Read after an answer's speech ends, which can be long after the render that started it.
  const handsFree = useRef(false);
  handsFree.current = conversing && !paused;

  useEffect(() => {
    save(chat);
  }, [chat]);

  useEffect(() => {
    if (conversing) setPaused(false);
  }, [conversing]);

  const { cancel: cancelListening } = voice;
  const { silence } = speaker;
  useEffect(() => {
    if (active) return;
    cancelListening();
    silence();
  }, [active, cancelListening, silence]);

  async function send(text, { spoken = false } = {}) {
    const question = text.trim();
    if (!question || busy) return;
    speaker.silence();
    const asked = [...chat.messages, { role: "user", content: question }];
    setChat({ ...chat, messages: asked });
    setDraft("");
    setBusy(true);
    const history = historyForApi(asked);
    const { ok, data } = await postJson("/chat", { sessionId: chat.sessionId, messages: history }).catch(() => ({ ok: false, data: {} }));
    setBusy(false);
    mood.flash(answerMoment({ ok, products: data.products || [], suggested: Boolean(data.suggested), question }));
    const next = ok
      ? { role: "assistant", content: data.reply, products: data.products || [], suggested: Boolean(data.suggested), ...(data.quoteDraft ? { quoteDraft: data.quoteDraft } : {}) }
      : { role: "notice", content: data.error || "Không kết nối được trợ lý, bạn thử lại sau nhé." };
    setChat((current) => ({ ...current, messages: [...current.messages, next] }));
    const autoRead = spoken && !readAloudChosen.current;
    if (autoRead) setReadAloud(true);
    if (ok && (readAloud || autoRead || handsFree.current)) speakThenListen(data.reply);
  }

  // In hands-free mode the mic opens only when the speech was heard to the end: a pause, a closed screen or a
  // blocked or failed speech leaves it off, so the page never starts recording on its own after something went wrong.
  async function speakThenListen(text) {
    const outcome = await speaker.say(text);
    if (outcome === "ended" && handsFree.current) voice.start();
    return outcome;
  }

  // Called from the visitor's tap on "Cho phép & nghe": the blocked answer's audio is kept, so it starts inside the tap.
  function playBlocked() {
    return speakThenListen(speaker.blockedText);
  }

  function pause() {
    setPaused(true);
    voice.cancel();
    speaker.silence();
  }

  // Called from a tap, so the mic is allowed to start.
  function resume() {
    setPaused(false);
    speaker.silence();
    voice.start();
  }

  // Turning the speaker on also reads the answer already on screen, so the visitor hears something right away.
  function toggleReadAloud() {
    readAloudChosen.current = true;
    speaker.silence();
    const next = !readAloud;
    setReadAloud(next);
    const latest = [...chat.messages].reverse().find((m) => m.role === "assistant");
    if (next && latest) speaker.say(latest.content);
  }

  function toggleMic() {
    if (voiceActive) return voice.stop();
    speaker.silence();
    return voice.start();
  }

  // Only ever called from the visitor's own tap on a draft: the assistant drafts, the visitor sends.
  async function submitQuote(index, form) {
    const body = {
      source: "chat",
      customerName: form.customerName,
      phone: form.phone,
      email: form.email,
      companyName: form.companyName,
      message: form.note,
      items: form.items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
    };
    const { ok, data } = await postJson("/quote-requests", body)
      .catch((error) => ({ ok: false, data: { error: `Chưa kết nối được máy chủ (${error.message}). Phiếu vẫn được giữ để bạn gửi lại.` } }));
    if (!ok) return { error: data.error || "Không gửi được yêu cầu, bạn thử lại nhé." };
    setChat((current) => ({
      ...current,
      messages: current.messages.map((m, i) => (i === index ? { ...m, quoteDraft: form, quoteSent: { id: data.id } } : m)),
    }));
    mood.flash("success");
    return { id: data.id };
  }

  function restart() {
    setChat({ sessionId: newSessionId(), messages: [] });
  }

  return {
    messages: chat.messages, draft, setDraft, busy, send, restart, readAloud, toggleReadAloud, submitQuote,
    voice, voiceActive, micAvailable: canListen(), toggleMic, speaker, playBlocked, mimiState: mood.state,
    // A poke shows her reaction and counts as activity, so a dozing Mimi wakes up and her doze timer starts over.
    pokeMimi: mood.flash,
    conversation: { paused, pause, resume, speakThenListen },
  };
}
