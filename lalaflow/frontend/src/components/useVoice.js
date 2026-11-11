// Voice for the assistant, using the local speech service on :8000 (same protocol as web/app.js).
// The speech-to-text model is licensed CC-BY-NC-ND-4.0 (non-commercial): fine for internal trials, it has to be
// replaced before the shop's public site relies on it. The text-to-speech voice is CC-BY-4.0.
import { useCallback, useEffect, useRef, useState } from "react";
import { SPEECH_ORIGIN } from "../api.js";

const SAMPLE_RATE = 16000;
// After a finished sentence, wait this long for more speech before treating the question as complete.
const END_OF_QUESTION_MS = 1500;
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
        current.endTimer = setTimeout(stop, END_OF_QUESTION_MS);
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

// Prices read better as words: "180.000đ/cuộn" → "180000 đồng một cuộn".
export function speakable(text) {
  const spoken = text
    .replace(/(\d{1,3}(?:\.\d{3})+)\s*đ/g, (_, n) => `${n.replace(/\./g, "")} đồng`)
    .replace(/(\d+)\s*đ\b/g, "$1 đồng")
    .replace(/\s*\/\s*/g, " một ")
    .replace(/\s+/g, " ")
    .trim();
  if (spoken.length <= MAX_SPOKEN_CHARS) return spoken;
  const cut = spoken.slice(0, MAX_SPOKEN_CHARS);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return end > 0 ? cut.slice(0, end + 1) : cut;
}

export function useSpeaker() {
  const audio = useRef(null);
  const [problem, setProblem] = useState("");

  const silence = useCallback(() => {
    if (!audio.current) return;
    audio.current.pause();
    URL.revokeObjectURL(audio.current.src);
    audio.current = null;
  }, []);

  const say = useCallback(async (text) => {
    silence();
    setProblem("");
    const input = speakable(text);
    if (!input) return;
    try {
      const response = await fetch(`${SPEECH_ORIGIN}/v1/audio/speech`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ input }) });
      if (!response.ok) throw new Error(`speech ${response.status}`);
      const player = new Audio(URL.createObjectURL(await response.blob()));
      audio.current = player;
      player.addEventListener("ended", silence, { once: true });
      await player.play();
    } catch (err) {
      // The written answer is already on screen, so this only explains why there is no sound.
      console.warn(`Assistant could not read the answer aloud: ${err.message}`);
      setProblem(err.name === "NotAllowedError"
        ? "Trình duyệt đang chặn tự phát âm thanh. Bấm vào trang một lần hoặc cho phép âm thanh ở thanh địa chỉ."
        : "Chưa đọc được câu trả lời (dịch vụ giọng nói không phản hồi).");
      silence();
    }
  }, [silence]);

  useEffect(() => silence, [silence]);
  return { say, silence, problem };
}
