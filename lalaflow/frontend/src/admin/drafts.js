import { useEffect, useState } from "react";

// Hands a prefilled form from one admin screen to the next (quote → order, website request → quotation / email).
const drafts = new Map();

export function putDraft(key, value) {
  drafts.set(key, value);
}

// Read during the first render, cleared after mount so a later visit starts empty (safe under StrictMode double render).
export function useDraft(key) {
  const [draft] = useState(() => drafts.get(key) || null);
  useEffect(() => {
    drafts.delete(key);
  }, [key]);
  return draft;
}
