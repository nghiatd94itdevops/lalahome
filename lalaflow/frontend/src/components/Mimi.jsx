import { useEffect, useId, useMemo, useRef, useState } from "react";
// The brand kit in /LaLaHome is the single source of the mascot: these scripts define window.MIMI_ASSETS and
// window.MimiBot (states, seasons, festivals). Updating the kit there updates the site on the next build.
// Trial of the newer kit in /LaLaHome/LaLaHome, which adds the chubby cat; the letter-L kit one folder up is kept
// for rollback (this kit also still draws "L", so setting VARIANT back is enough).
import "../../../../LaLaHome/LaLaHome/mimi-svg.js";
import "../../../../LaLaHome/LaLaHome/mimi-bot.js";

const PERSONA = "friendly";
const VARIANT = "chubby";
const SHOP_TIME_ZONE = "Asia/Ho_Chi_Minh";
const DAY_MS = 24 * 60 * 60 * 1000;
// Lunar holidays as solar dates (the kit has no lunar calendar). Extend the table after 2030.
const TET_DATES = ["2026-02-17", "2027-02-06", "2028-01-26", "2029-02-13", "2030-02-03"];
const MID_AUTUMN_DATES = ["2026-09-25", "2027-09-15", "2028-10-03", "2029-09-22", "2030-09-12"];
// How many days around each holiday Mimi dresses for it.
const FESTIVAL_WINDOWS = [
  { festival: "tet", dates: TET_DATES, before: 10, after: 7 },
  { festival: "midautumn", dates: MID_AUTUMN_DATES, before: 7, after: 2 },
];
const HALLOWEEN_FROM_DAY = 24;
const SEASON_BY_MONTH = ["winter", "spring", "spring", "spring", "summer", "summer", "summer", "autumn", "autumn", "autumn", "winter", "winter"];

// The shop's local calendar day and time, whatever the visitor's own time zone.
function shopClock(date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: SHOP_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(date).map((p) => [p.type, p.value]));
  return { day: `${parts.year}-${parts.month}-${parts.day}`, month: Number(parts.month), dayOfMonth: Number(parts.day), time: `${parts.hour}:${parts.minute}` };
}

function festivalOn(clock) {
  const today = Date.parse(clock.day);
  const near = FESTIVAL_WINDOWS.find(({ dates, before, after }) => dates.some((d) => today >= Date.parse(d) - before * DAY_MS && today <= Date.parse(d) + after * DAY_MS));
  if (near) return near.festival;
  return clock.month === 10 && clock.dayOfMonth >= HALLOWEEN_FROM_DAY ? "halloween" : null;
}

// What Mimi is up to right now, from the kit's time-of-day states ("08:00 Cà phê & bánh mì" …): the latest slot that
// has started today, its label and her line, plus the season and any holiday outfit for the date.
export function mimiForNow(date = new Date()) {
  const clock = shopClock(date);
  const slots = Object.entries(window.MimiBot.STATES).filter(([, st]) => st.time).sort(([, a], [, b]) => a.time.localeCompare(b.time));
  const [state, slot] = slots.filter(([, st]) => st.time <= clock.time).at(-1) || slots.at(-1);
  return { state, label: slot.label, line: slot.b, time: clock.time, season: SEASON_BY_MONTH[clock.month - 1], festival: festivalOn(clock) };
}

const CLOCK_TICK_MS = 60 * 1000;

// mimiForNow(), refreshed every minute so she changes activity when the next time slot starts.
export function useMimiNow() {
  const [now, setNow] = useState(() => mimiForNow());
  useEffect(() => {
    const timer = setInterval(() => setNow(mimiForNow()), CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, []);
  return now;
}
// Crop of the 400×410 drawing around the head and ears, placed from the kit's head centre for the variant (for "L"
// that is 178,148, giving 62 14 232 236).
const HEAD_CROP = { left: 116, top: 134, width: 232, height: 236 };

function headViewBox(variant) {
  const { cx, cy } = window.MIMI_ASSETS.VARIANT_GEO[variant].head;
  return `${cx - HEAD_CROP.left} ${cy - HEAD_CROP.top} ${HEAD_CROP.width} ${HEAD_CROP.height}`;
}

// The kit's still drawing for a variant, with a resting face. The chubby cat's head art must sit under its ears,
// which the animated bot fixes after building; done here the same way.
function stillMascotMarkup(prefix, variant) {
  const { buildSVG, buildFace, buildChubbyFace } = window.MIMI_ASSETS;
  const isChubby = variant === "chubby";
  const face = (isChubby ? buildChubbyFace : buildFace)(prefix, { eyes: "happy", mouth: "w" });
  const markup = buildSVG(prefix, variant)
    .replace(/viewBox="[^"]*"/, `viewBox="${headViewBox(variant)}"`)
    .replace('<g class="mm-face"></g>', `<g class="mm-face">${face}</g>`);
  if (!isChubby) return markup;
  const template = document.createElement("template");
  template.innerHTML = markup;
  const headArt = template.content.querySelector(".mm-art-head")?.parentNode;
  const leftEar = template.content.querySelector(".mm-earw-l");
  if (headArt && leftEar) leftEar.parentNode.insertBefore(headArt, leftEar);
  return template.innerHTML;
}

// The live mascot. `state` is one of the kit's 33 states (idle, greet, thinking, success, …); changing `celebrate`
// to a new number fires a confetti burst. Decorative only, so hidden from screen readers.
export function Mimi({ state = "idle", season = null, festival = null, celebrate = 0, className = "" }) {
  const host = useRef(null);
  const bot = useRef(null);

  useEffect(() => {
    // The speech bubble stays off: the owner asked for no message bubble above the mascot.
    const instance = new window.MimiBot(host.current, { persona: PERSONA, variant: VARIANT, state, season, festival, bubble: false });
    bot.current = instance;
    return () => {
      instance.destroy();
      bot.current = null;
    };
    // Created once; the effects below forward later changes to the running instance.
  }, []);

  useEffect(() => { bot.current?.setState(state); }, [state]);
  useEffect(() => { bot.current?.setSeason(season); }, [season]);
  useEffect(() => { bot.current?.setFestival(festival); }, [festival]);
  useEffect(() => { if (celebrate) bot.current?.celebrate(); }, [celebrate]);

  return <div ref={host} className={`mimi ${className}`} data-state={state} data-season={season || ""} data-festival={festival || ""} aria-hidden="true" />;
}

const POKE_REACTION_MS = 2500;
// Pokes closer together than this count as one streak, which makes her lines escalate.
const POKE_STREAK_MS = 4000;
const DIZZY_AFTER_POKES = 4;
const PARTY_AFTER_POKES = 7;
// States are the brand kit's; lines are what she says in the bubble. Played in order so a run of pokes never
// repeats the same line twice in a row.
const POKE_REACTIONS = [
  { state: "love", line: "Hí hí, nhột quá à 🙈" },
  { state: "surprised", line: "Ơ! Ai vừa chọc Mimi đó?" },
  { state: "wink", line: "Chọc Mimi là phải ghé xem giấy đó nha 😜" },
  { state: "happy", line: "Meo~ Mimi thích được vuốt ve lắm!" },
  { state: "love", line: "Bạn dễ thương ghê, Mimi ngại quá à 🙈" },
];
const WAKE_REACTIONS = [
  { state: "surprised", line: "Á! Mimi đâu có ngủ… chỉ nhắm mắt suy nghĩ thôi 😅" },
  { state: "confused", line: "Ơ… tới ca của Mimi rồi hả? Dậy đây, dậy đây!" },
];
const DIZZY = { state: "confused", line: "Thôi thôi, chóng mặt quá rồi nè 😵" };
const PARTY = { state: "party", line: "Bạn chọc giỏi ghê! Giờ mình đi chọn giấy nha? 🎉", confetti: true };

function pokeReaction({ sleeping, streak, turn }) {
  if (sleeping) return WAKE_REACTIONS[turn % WAKE_REACTIONS.length];
  if (streak === PARTY_AFTER_POKES) return PARTY;
  if (streak === DIZZY_AFTER_POKES) return DIZZY;
  return POKE_REACTIONS[turn % POKE_REACTIONS.length];
}

// A Mimi the visitor can poke: she pulls a face and says something funny in a bubble for a moment, and wakes up
// if she was dozing. `onPoke(state)` lets the assistant's mood know (it restarts her doze timer); `className`
// sizes and places the mascot as it did on a plain <Mimi>.
export function PokableMimi({ state = "idle", onPoke, className = "", ...look }) {
  const [reaction, setReaction] = useState(null);
  const [confetti, setConfetti] = useState(0);
  const streak = useRef({ count: 0, at: 0 });
  const turn = useRef(0);

  useEffect(() => {
    if (!reaction) return undefined;
    const timer = setTimeout(() => setReaction(null), POKE_REACTION_MS);
    return () => clearTimeout(timer);
  }, [reaction]);

  function poke() {
    const now = Date.now();
    const run = streak.current;
    run.count = now - run.at < POKE_STREAK_MS ? run.count + 1 : 1;
    run.at = now;
    const next = pokeReaction({ sleeping: state === "sleep", streak: run.count, turn: turn.current });
    turn.current += 1;
    setReaction({ ...next, at: now });
    if (next.confetti) setConfetti((n) => n + 1);
    onPoke?.(next.state);
  }

  return (
    <button type="button" className={`mimi-poke ${className}`} onClick={poke} aria-label="Chọc Mimi">
      <Mimi state={reaction?.state || state} celebrate={confetti} className="mimi-poke-figure" {...look} />
      {reaction && <span key={reaction.at} className="mimi-poke-bubble" role="status">{reaction.line}</span>}
    </button>
  );
}

// An empty or error message with Mimi acting it out beside the text (sad when nothing matches, error when data
// could not load, …). Keeps the site's .empty-note box.
export function MimiNote({ state, children, className = "" }) {
  return (
    <div className={`empty-note mimi-note ${className}`}>
      <Mimi state={state} className="mimi-note-figure" />
      <div className="mimi-note-text">{children}</div>
    </div>
  );
}

// A still head for spots that repeat (one per chat message): the kit's own drawing without the animation engine,
// so a long conversation does not run dozens of animated mascots.
export function MimiFace({ className = "" }) {
  const prefix = `mf${useId().replace(/[^a-zA-Z0-9]/g, "")}_`;
  const markup = useMemo(() => stillMascotMarkup(prefix, VARIANT), [prefix]);
  const colors = useMemo(() => {
    const vars = window.MIMI_ASSETS.deriveColors({});
    // The collar takes the state colour (--mm-s*); a resting face uses the brand accent, as the "idle" state does.
    return { ...vars, "--mm-s0": vars["--mm-a0"], "--mm-s1": vars["--mm-a"], "--mm-s2": vars["--mm-a2"] };
  }, []);
  return <span className={`mimi-face ${className}`} style={colors} aria-hidden="true" dangerouslySetInnerHTML={{ __html: markup }} />;
}
