const CHORD_REGEX =
  /^([A-G](#|b)?m?(maj|min)?(dim|aug)?(sus2|sus4|sus)?(\d+)?(add\d+)?(\/[A-G](#|b)?)?)$/i;

const NC_REGEX = /^(N\.?C\.?)|x+|-+$/i;

export default function analyzeLine(text: string) {
  const tokens = text.split(/([\s-|]+)/);
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
