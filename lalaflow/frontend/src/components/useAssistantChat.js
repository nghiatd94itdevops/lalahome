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
const HISTORY_SENT = 10;
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
// looked up again instead of guessed.
const toApiMessage = (m) => ({
  role: m.role,
  content: m.role === "assistant" && m.products?.length
    ? `${m.content}\nSản phẩm đã giới thiệu: ${m.products.map((p) => `${p.name} [#${p.id}]`).join(", ")}`
    : m.content,
});

// Mimi's reaction to an answer: thanked → love, nothing found → sad, only suggestions → wink, a match → happy.
function answerMoment({ ok, products, suggested, question }) {
  if (!ok) return "error";
  if (THANKS.test(question)) return "love";
  if (!products.length) return "sad";
  return suggested ? "wink" : "happy";
}

// What Mimi shows: a short moment (greeting, a reaction to the answer) wins for MOMENT_MS, otherwise the chat's
// current activity.
function useMimiMood({ active, busy, listening }) {
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
    if (!active || busy || listening) return undefined;
    const timer = setTimeout(() => setDozing(true), DOZE_AFTER_MS);
    return () => clearTimeout(timer);
  }, [active, busy, listening, moment]);

  let state = "idle";
  if (dozing) state = "sleep";
  if (listening) state = "listening";
  if (moment) state = moment.state;
  if (busy) state = searching ? "searching" : "thinking";
  return { state, flash };
}

// `active`: the panel is open or the full page is shown. When it goes false the mic and speech stop, dropping a
// half-spoken question instead of sending it.
export function useAssistantChat({ active }) {
  const [chat, setChat] = useState(loadSaved);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  // Off until the visitor turns it on, or asks by voice (then answers are read too, unless they switched it off).
  const [readAloud, setReadAloud] = useState(false);
  const readAloudChosen = useRef(false);
  const speaker = useSpeaker();
  const voice = useVoiceInput((question) => send(question, { spoken: true }));
  const voiceActive = voice.state !== "idle";
  const mood = useMimiMood({ active, busy, listening: voiceActive || draft.trim().length > 0 });

  useEffect(() => {
    save(chat);
  }, [chat]);

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
    const history = asked.filter((m) => m.role !== "notice").slice(-HISTORY_SENT).map(toApiMessage);
    const { ok, data } = await postJson("/chat", { sessionId: chat.sessionId, messages: history }).catch(() => ({ ok: false, data: {} }));
    setBusy(false);
    mood.flash(answerMoment({ ok, products: data.products || [], suggested: Boolean(data.suggested), question }));
    const next = ok
      ? { role: "assistant", content: data.reply, products: data.products || [], suggested: Boolean(data.suggested) }
      : { role: "notice", content: data.error || "Không kết nối được trợ lý, bạn thử lại sau nhé." };
    setChat((current) => ({ ...current, messages: [...current.messages, next] }));
    const autoRead = spoken && !readAloudChosen.current;
    if (autoRead) setReadAloud(true);
    if (ok && (readAloud || autoRead)) speaker.say(data.reply);
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

  function restart() {
    setChat({ sessionId: newSessionId(), messages: [] });
  }

  return {
    messages: chat.messages, draft, setDraft, busy, send, restart, readAloud, toggleReadAloud,
    voice, voiceActive, micAvailable: canListen(), toggleMic, speaker, mimiState: mood.state,
  };
}
