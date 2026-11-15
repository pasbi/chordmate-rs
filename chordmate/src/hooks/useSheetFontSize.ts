import { useCallback, useState } from "react";

const STORAGE_KEY = "chordmate.sheetFontSize";
export const MIN_SHEET_FONT_SIZE = 10;
export const MAX_SHEET_FONT_SIZE = 40;
const DEFAULT_SHEET_FONT_SIZE = 16;

function clampFontSize(size: number) {
  return Math.min(Math.max(Math.round(size), MIN_SHEET_FONT_SIZE), MAX_SHEET_FONT_SIZE);
}

function readStoredFontSize() {
  try {
    const stored = Number(localStorage.getItem(STORAGE_KEY));
    return Number.isFinite(stored) && stored > 0 ? clampFontSize(stored) : DEFAULT_SHEET_FONT_SIZE;
  } catch {
    return DEFAULT_SHEET_FONT_SIZE;
  }
}

/** Font size of the chord sheet in px, remembered per device. */
export function useSheetFontSize() {
  const [fontSize, setFontSizeState] = useState(readStoredFontSize);
  const setFontSize = useCallback((size: number) => {
    const clamped = clampFontSize(size);
    setFontSizeState(clamped);
    try {
      localStorage.setItem(STORAGE_KEY, String(clamped));
    } catch {
      // Not remembered, e.g. in a private window.
    }
  }, []);
  return { fontSize, setFontSize };
}
