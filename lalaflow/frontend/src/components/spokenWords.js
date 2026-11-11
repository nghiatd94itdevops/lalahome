// How the voice reads words and symbols it would otherwise get wrong. Staff edit the table in
// Admin → Nội dung website → Từ điển giọng đọc; it is stored under this site-content key.
import { useEffect, useState } from "react";
import { getJson } from "../api.js";

export const SPOKEN_WORDS_KEY = "spoken_words";

// Used until the table has been saved once.
export const DEFAULT_SPOKEN_WORDS = [
  { match: "La La Home", say: "La La Hôm" },
  { match: "Mimi", say: "mi mi" },
  { match: "*", say: "" },
  { match: "/", say: "trên" },
];

const WORD_CHAR = /[\p{L}\p{N}]/u;
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Any staff member with content rights can save any shape under a site-content key, so rows are checked here.
export function parseSpokenWords(stored) {
  if (!Array.isArray(stored?.words)) return DEFAULT_SPOKEN_WORDS;
  return stored.words
    .filter((row) => typeof row?.match === "string" && row.match.trim() && typeof row.say === "string")
    .map((row) => ({ match: row.match.trim(), say: row.say.trim() }));
}

// Spaces in `match` also match no space, so "La La Home" covers "LaLaHome" and "Lala Home". Letters and digits at
// either end must stand alone (\b only knows ASCII, so Vietnamese letters are spelled out): "Mimi" leaves "Mimis".
function patternFor(match) {
  const body = match.split(/\s+/).map(escapeRegExp).join("\\s*");
  const start = WORD_CHAR.test(match[0]) ? "(?<![\\p{L}\\p{N}])" : "";
  const end = WORD_CHAR.test(match.at(-1)) ? "(?![\\p{L}\\p{N}])" : "";
  return `${start}${body}${end}`;
}

// One pass over the text, longest entry first, so "La La Home" wins over a "Home" row and a reading is never
// rewritten by another row.
export function compileSpokenWords(words) {
  if (!words.length) return (text) => text;
  const ordered = [...words].sort((a, b) => b.match.length - a.match.length);
  const pattern = new RegExp(ordered.map((row) => `(${patternFor(row.match)})`).join("|"), "giu");
  return (text) => text.replace(pattern, (...groups) => {
    const index = groups.slice(1, ordered.length + 1).findIndex((group) => group !== undefined);
    return ` ${ordered[index].say} `;
  });
}

let loading = null;

function loadSpokenWords() {
  loading ??= getJson("/site-content")
    .then((content) => parseSpokenWords(content?.[SPOKEN_WORDS_KEY]))
    .catch((error) => {
      // The voice still works with the defaults; the next speaker on the page tries again.
      console.warn(`Could not load the pronunciation table: ${error.message}`);
      loading = null;
      return DEFAULT_SPOKEN_WORDS;
    });
  return loading;
}

// The reader for the saved table; the defaults until it has loaded. Changes in admin apply on the next page load.
export function useSpokenWords() {
  const [read, setRead] = useState(() => compileSpokenWords(DEFAULT_SPOKEN_WORDS));
  useEffect(() => {
    let mounted = true;
    loadSpokenWords().then((words) => mounted && setRead(() => compileSpokenWords(words)));
    return () => { mounted = false; };
  }, []);
  return read;
}
