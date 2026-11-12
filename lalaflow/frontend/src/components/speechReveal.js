// How much of an answer to show while its audio plays, so the text appears as Mimi says it. The audio gives only
// "how far through" (currentTime / duration), so each character gets a rough share of the speaking time: digits
// take longer to say than to write ("180.000đ" is read "một trăm tám mươi nghìn đồng") and the voice pauses at
// punctuation. The reveal then runs to the end of the word being spoken, so a word never appears half written.
const DIGIT_WEIGHT = 4;
const SENTENCE_PAUSE_WEIGHT = 6;
const CLAUSE_PAUSE_WEIGHT = 3;
const SENTENCE_END = /[.!?…\n]/;
const CLAUSE_END = /[,;:]/;
const WORD_GAP = /\s/;

function weightOf(char) {
  if (/\d/.test(char)) return DIGIT_WEIGHT;
  if (SENTENCE_END.test(char)) return SENTENCE_PAUSE_WEIGHT;
  if (CLAUSE_END.test(char)) return CLAUSE_PAUSE_WEIGHT;
  return 1;
}

// Returns progress (0…1 of the audio) → number of characters of `text` to show.
export function revealSchedule(text) {
  const reached = [];
  let total = 0;
  for (const char of text) {
    total += weightOf(char);
    // Indexed by UTF-16 position so the result can be passed to String.slice; an emoji takes two slots.
    for (let i = 0; i < char.length; i += 1) reached.push(total);
  }
  return (progress) => {
    if (!(progress > 0)) return 0;
    if (progress >= 1) return text.length;
    const target = progress * total;
    let end = reached.findIndex((weight) => weight >= target);
    if (end < 0) return text.length;
    while (end < text.length && !WORD_GAP.test(text[end])) end += 1;
    return end;
  };
}
