// Voice for the assistant, using the local speech service on :8000.
// The speech-to-text model is licensed CC-BY-NC-ND-4.0 (non-commercial): fine for internal trials, it has to be
// replaced before the shop's public site relies on it. The text-to-speech voice is CC-BY-4.0.
import { useCallback, useEffect, useRef, useState } from "react";
import { SPEECH_ORIGIN } from "../api.js";
import { useSpokenWords } from "./spokenWords.js";
import { revealSchedule } from "./speechReveal.js";

const SAMPLE_RATE = 16000;
// After a finished sentence, wait this long for more speech before treating the question as complete.
const END_OF_QUESTION_MS = 1500;
// Longer when what was said so far cannot end a question ("tôi cần giấy… khoảng", "ờ…") or is only a word or two:
// the visitor is still thinking, and sending now would cut the question in half.
const MID_THOUGHT_MS = 3500;
const SHORTEST_QUESTION_WORDS = 3;
const UNFINISHED_ENDING = /(?:^|\s)(?:và|với|hoặc|hay|là|của|cho|để|mà|thì|nhưng|vì|nếu|khoảng|tầm|cỡ|dưới|trên|từ|đến|tới|loại|kiểu|như|màu|cái|những|các|mấy|một|hai|ba|bốn|năm|sáu|bảy|tám|chín|mười|ờ|ừ|ừm|à|ơ|ừa)$/u;

function waitAfter(text) {
  const words = text.toLocaleLowerCase("vi-VN").trim().split(/\s+/);
  const unfinished = words.length < SHORTEST_QUESTION_WORDS || UNFINISHED_ENDING.test(words.join(" "));
  return unfinished ? MID_THOUGHT_MS : END_OF_QUESTION_MS;
}
const MAX_SPOKEN_CHARS = 500;
const socketUrl = `${SPEECH_ORIGIN.replace(/^http/, "ws")}/v1/stt/stream`;

const PAPER_SIZE_DIGITS = { "không": 0, "một": 1, "hai": 2, "ba": 3, "bốn": 4, "năm": 5, "sáu": 6 };

// The recogniser spells paper sizes out ("giấy a bốn"); write them the way product names do ("giấy A4").
// Word edges are spelled out because \b only knows ASCII letters; "a bốn mươi" (forty) is a number, not a size.
const paperSizes = (text) => text.replace(
  /(?<![\p{L}\p{N}])a (không|một|hai|ba|bốn|năm|sáu)(?![\p{L}\p{N}])(?! (?:mươi|trăm|nghìn|ngàn|triệu|lăm|lẻ)(?![\p{L}\p{N}]))/gu,
  (_, digit) => `A${PAPER_SIZE_DIGITS[digit]}`,
);

const sentenceCase = (text) => {
  const lower = paperSizes(text.toLocaleLowerCase("vi-VN").trim());
  return lower.charAt(0).toLocaleUpperCase("vi-VN") + lower.slice(1);
};

export const canListen = () => Boolean(navigator.mediaDevices?.getUserMedia && window.AudioWorkletNode && window.isSecureContext);

// The socket may already be open by the time the worklet has loaded; waiting for an "open" event that has already
// fired would hang forever.
function opened(socket) {
  if (socket.readyState === WebSocket.OPEN) return Promise.resolve();
  if (socket.readyState !== WebSocket.CONNECTING) return Promise.reject(new Error("socket closed"));
  return new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", () => reject(new Error("socket error")), { once: true });
  });
}

const MIC_ERRORS = {
  NotAllowedError: "Bạn chưa cho phép trang dùng micro. Hãy bấm biểu tượng ổ khoá trên thanh địa chỉ để cho phép.",
  NotFoundError: "Không tìm thấy micro trên thiết bị này.",
  NotReadableError: "Micro đang được ứng dụng khác dùng.",
};

// state: idle → starting → listening → finishing → idle; onQuestion receives the whole spoken question.
export function useVoiceInput(onQuestion) {
  const [state, setState] = useState("idle");
  const [heard, setHeard] = useState("");
  const [error, setError] = useState("");
  const session = useRef(null);
  // Bumped by cancel(): a start() still waiting for the mic or the socket sees the change and gives up.
  const attempt = useRef(0);
  const onQuestionRef = useRef(onQuestion);
  onQuestionRef.current = onQuestion;

  const release = useCallback((current) => {
    if (!current || current.released) return;
    current.released = true;
    clearTimeout(current.endTimer);
    current.media.getTracks().forEach((track) => track.stop());
    current.context.close();
  }, []);

  const stop = useCallback(() => {
    const current = session.current;
    if (!current || current.stopping) return;
    current.stopping = true;
    setState("finishing");
    current.worklet.port.onmessage = null;
    release(current);
    if (current.socket.readyState === WebSocket.OPEN) current.socket.send(JSON.stringify({ type: "stop" }));
    else current.socket.close();
  }, [release]);

  // Unlike stop(), nothing heard so far is sent: used when the visitor closes the assistant mid-question.
  const cancel = useCallback(() => {
    attempt.current += 1;
    const current = session.current;
    setHeard("");
    if (!current) return;
    current.discarded = true;
    current.finals = [];
    current.partial = "";
    release(current);
    current.socket.close();
  }, [release]);

  const start = useCallback(async () => {
    if (session.current) return;
    const thisAttempt = attempt.current;
    setError("");
    setHeard("");
    setState("starting");
    // Created before any await, while the click still counts as a user gesture; otherwise the browser may keep it
    // suspended and no audio ever reaches the worklet.
    const context = new AudioContext();
    let media;
    try {
      media = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      await context.resume();
    } catch (err) {
      context.close();
      setError(MIC_ERRORS[err.name] || `Không mở được micro: ${err.message}`);
      setState("idle");
      return;
    }
    if (thisAttempt !== attempt.current) {
      media.getTracks().forEach((track) => track.stop());
      context.close();
      setState("idle");
      return;
    }
    const socket = new WebSocket(socketUrl);
    socket.binaryType = "arraybuffer";
    const current = { media, context, socket, finals: [], partial: "" };
    session.current = current;
    try {
      await context.audioWorklet.addModule(`${SPEECH_ORIGIN}/pcm-worklet.js`);
      current.worklet = new AudioWorkletNode(context, "pcm-downsampler");
      context.createMediaStreamSource(media).connect(current.worklet);
      await opened(socket);
    } catch {
      release(current);
      socket.close();
      session.current = null;
      if (!current.discarded) setError("Chưa kết nối được dịch vụ giọng nói, bạn gõ câu hỏi giúp mình nhé.");
      setState("idle");
      return;
    }
    if (current.discarded) {
      session.current = null;
      setState("idle");
      return;
    }
    socket.send(JSON.stringify({ type: "start", sample_rate: SAMPLE_RATE, language: "vi" }));
    current.worklet.port.onmessage = (event) => {
      if (socket.readyState === WebSocket.OPEN) socket.send(event.data);
    };
    const show = () => setHeard([...current.finals, current.partial].filter(Boolean).join(" "));
    socket.addEventListener("message", (event) => {
      if (current.discarded) return;
      const message = JSON.parse(event.data);
      if (message.type === "ready") setState("listening");
      if (message.type === "partial" && message.text) {
        current.partial = sentenceCase(message.text);
        clearTimeout(current.endTimer);
        show();
      }
      if (message.type === "final" && message.text) {
        current.finals.push(sentenceCase(message.text));
        current.partial = "";
        show();
        clearTimeout(current.endTimer);
        current.endTimer = setTimeout(stop, waitAfter(current.finals.join(" ")));
      }
      if (message.type === "error" && message.code !== "idle_timeout") setError(`Dịch vụ giọng nói báo lỗi: ${message.message}`);
    });
    socket.addEventListener("close", () => {
      release(current);
      session.current = null;
      setState("idle");
      const question = [...current.finals, current.partial].filter(Boolean).join(" ").trim();
      setHeard("");
      if (question && !current.discarded) onQuestionRef.current(question);
    });
  }, [release, stop]);

  useEffect(() => cancel, [cancel]);

  return { state, heard, error, start, stop, cancel };
}

// The model writes answers with markdown (**đậm**, "- " lists, # headings); the voice would read the symbols out.
// Each line becomes its own sentence so list items get a pause instead of running together.
function withoutMarkdown(text) {
  return text
    .replace(/[*_`#~]+/g, "")
    .replace(/^\s*(?:[-•+>]|\d+[.)])\s+/gm, "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => (/[.!?…:;,]$/.test(line) ? line : `${line}.`))
    .join(" ");
}

// Prices read better as words: "180.000đ/cuộn" → "180000 đồng một cuộn". Every other word or symbol the voice gets
// wrong is in the pronunciation table (`readWords`, see spokenWords.js), which runs after the price rules.
export function speakable(text, readWords = (spoken) => spoken) {
  const prices = withoutMarkdown(text)
    .replace(/(\d{1,3}(?:\.\d{3})+)\s*đ/g, (_, n) => `${n.replace(/\./g, "")} đồng`)
    .replace(/(\d+)\s*đ\b/g, "$1 đồng")
    .replace(/đồng\s*\/\s*/g, "đồng một ");
  const spoken = readWords(prices)
    .replace(/\s+/g, " ")
    .replace(/\s+([.,!?;:…])/g, "$1")
    .trim();
  if (spoken.length <= MAX_SPOKEN_CHARS) return spoken;
  const cut = spoken.slice(0, MAX_SPOKEN_CHARS);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return end > 0 ? cut.slice(0, end + 1) : cut;
}

export async function fetchSpeech(input) {
  const response = await fetch(`${SPEECH_ORIGIN}/v1/audio/speech`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ input }) });
  if (!response.ok) throw new Error(`speech service answered ${response.status} for ${input.length} characters`);
  return response.blob();
}

const SILENT_SAMPLES = 80;

// 10 ms of silence: what the player plays inside the visitor's first tap to unlock itself.
function silentWavUrl() {
  const sampleRate = 8000;
  const dataBytes = SILENT_SAMPLES * 2;
  const view = new DataView(new ArrayBuffer(44 + dataBytes));
  const ascii = (offset, text) => [...text].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)));
  ascii(0, "RIFF"); view.setUint32(4, 36 + dataBytes, true); ascii(8, "WAVE");
  ascii(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  ascii(36, "data"); view.setUint32(40, dataBytes, true);
  return URL.createObjectURL(new Blob([view], { type: "audio/wav" }));
}

const GESTURE_EVENTS = ["touchend", "click", "keydown"];

// say() resolves with how the speech finished: "ended" (heard to the end), "stopped" (silenced or replaced),
// "blocked" (the browser refused to play without a tap) or "failed" (no audio from the speech service).
// An answer arrives seconds after the visitor's tap, and iPhone browsers only let an audio element play on its own
// once it has played inside a tap. So one element is kept for every answer and unlocked on the first tap anywhere.
// If sound is still blocked, `blockedText` holds the answer (its audio already fetched) until a tap replays it.
export function useSpeaker() {
  const element = useRef(null);
  const unlocked = useRef(false);
  // The clip now loaded in the element; null when nothing is playing.
  const audio = useRef(null);
  const finish = useRef(null);
  // Bumped by silence(): a say() still waiting for its audio sees the change and does not start playing.
  const turn = useRef(0);
  // Audio fetched ahead by preload(), so a tap can start it without waiting on the network: iPhone browsers only
  // allow sound that starts within the tap itself.
  const preloaded = useRef(new Map());
  // A ref so preload() and say() keep their identity when the saved table arrives after the first render.
  const readWords = useRef(null);
  readWords.current = useSpokenWords();
  const [problem, setProblem] = useState("");
  const [blockedText, setBlockedText] = useState("");
  const [speaking, setSpeaking] = useState(false);
  // Between say() and the first sound, while the speech service renders the audio (a few seconds for an answer).
  const [preparing, setPreparing] = useState(false);
  // The text being read and how many of its characters have been said so far (0 until the sound starts), so the
  // screen can write it out in step with the voice. Null when nothing is being read: the text is shown whole.
  const [reading, setReading] = useState(null);
  const frame = useRef(0);

  const player = useCallback(() => {
    element.current ??= new Audio();
    return element.current;
  }, []);

  useEffect(() => {
    let silence = null;
    const unlock = () => {
      if (unlocked.current || audio.current) return;
      silence ??= silentWavUrl();
      const target = player();
      target.src = silence;
      target.play()
        .then(() => {
          unlocked.current = true;
          // An answer may have taken the element over while the silence started; leave it playing.
          if (!audio.current) target.pause();
          GESTURE_EVENTS.forEach((name) => document.removeEventListener(name, unlock, true));
        })
        .catch((err) => console.warn(`Could not unlock speech playback on this tap: ${err.message}`));
    };
    GESTURE_EVENTS.forEach((name) => document.addEventListener(name, unlock, true));
    return () => {
      GESTURE_EVENTS.forEach((name) => document.removeEventListener(name, unlock, true));
      if (silence) URL.revokeObjectURL(silence);
    };
  }, [player]);

  const release = useCallback((outcome) => {
    const clip = audio.current;
    const done = finish.current;
    audio.current = null;
    finish.current = null;
    cancelAnimationFrame(frame.current);
    setSpeaking(false);
    setPreparing(false);
    setReading(null);
    if (clip) {
      element.current.pause();
      URL.revokeObjectURL(clip.url);
    }
    done?.(outcome);
  }, []);

  // Moves `reading` along with the audio once per frame, until the clip is released.
  const followAloud = useCallback((clip, target, text) => {
    const charsAt = revealSchedule(text);
    const tick = () => {
      if (audio.current !== clip) return;
      const known = Number.isFinite(target.duration) && target.duration > 0;
      const chars = known ? charsAt(target.currentTime / target.duration) : text.length;
      setReading((current) => (current?.text === text && current.chars === chars ? current : { text, chars }));
      frame.current = requestAnimationFrame(tick);
    };
    tick();
  }, []);

  const silence = useCallback(() => {
    turn.current += 1;
    release("stopped");
  }, [release]);

  const preload = useCallback(async (text) => {
    const input = speakable(text, readWords.current);
    if (!input || preloaded.current.has(input)) return;
    try {
      preloaded.current.set(input, await fetchSpeech(input));
    } catch (err) {
      // say() fetches again and reports the problem if the service is really down.
      console.warn(`Could not prepare speech ahead: ${err.message}`);
    }
  }, []);

  const say = useCallback(async (text) => {
    silence();
    const thisTurn = turn.current;
    setProblem("");
    setBlockedText("");
    const input = speakable(text, readWords.current);
    if (!input) return "ended";
    let blob;
    setPreparing(true);
    setReading({ text, chars: 0 });
    try {
      // No await when the audio is preloaded, so play() below still runs inside the visitor's tap.
      blob = preloaded.current.get(input) || await fetchSpeech(input);
      if (thisTurn !== turn.current) return "stopped";
    } catch (err) {
      // Without sound the answer is shown whole at once.
      console.warn(`Assistant could not read the answer aloud: ${err.message}`);
      setProblem("Chưa đọc được câu trả lời (dịch vụ giọng nói không phản hồi).");
      if (thisTurn === turn.current) {
        setPreparing(false);
        setReading(null);
      }
      return "failed";
    }
    const clip = { url: URL.createObjectURL(blob) };
    const target = player();
    audio.current = clip;
    target.src = clip.url;
    const outcome = new Promise((resolve) => { finish.current = resolve; });
    target.onended = () => {
      if (audio.current === clip) release("ended");
    };
    try {
      await target.play();
      unlocked.current = true;
      if (audio.current === clip) {
        setSpeaking(true);
        setPreparing(false);
        followAloud(clip, target, text);
      }
    } catch (err) {
      const blocked = err.name === "NotAllowedError";
      console.warn(`Assistant could not play speech: ${err.message}`);
      if (blocked) {
        // Kept so the visitor's tap on "Cho phép & nghe" starts it at once, inside that tap.
        preloaded.current.set(input, blob);
        setBlockedText(text);
      } else {
        setProblem("Chưa đọc được câu trả lời (dịch vụ giọng nói không phản hồi).");
      }
      if (audio.current === clip) release(blocked ? "blocked" : "failed");
    }
    return outcome;
  }, [silence, release, player, followAloud]);

  useEffect(() => silence, [silence]);
  return { say, silence, preload, problem, blockedText, speaking, preparing, reading };
}
