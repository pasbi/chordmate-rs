const CHORD_REGEX_BASE =
  /([A-G]([#b])?m?(maj|min)?(dim|aug)?(sus2|sus4|sus)?(\d+)?(add\d+)?(\/[A-G]([#b])?)?)/;

const CHORD_REGEX = new RegExp(
  `^((${CHORD_REGEX_BASE.source})|\\((${CHORD_REGEX_BASE.source})\\))$`,
  "i"
);

const NC_REGEX = /^(N\.?C\.?)|x+|-+$/i;

export function detectChords(line: string) {
  const tokens = line.split(/([\s-|]+)/);
  let offset = 0;

  let chordCount = 0;
  let nonChordWordCount = 0;

  const highlightRanges: { start: number; end: number }[] = [];

  for (const token of tokens) {
    if (token.trim() === "") {
      offset += token.length;
      continue;
    }

    if (NC_REGEX.test(token)) {
      chordCount++;
    } else if (CHORD_REGEX.test(token)) {
      chordCount++;
      highlightRanges.push({
        start: offset,
        end: offset + token.length,
      });
    } else if (/[a-zA-Z']/i.test(token)) {
      nonChordWordCount++;
    }

    offset += token.length;
  }

  const isChordLine = chordCount > 0 && nonChordWordCount === 0;

  return {
    isChordLine,
    matches: highlightRanges,
  };
}

export function detectSectionHeader(line: string) {
  return /^\[[a-z0-9 -/]+\]$/i.test(line);
}
