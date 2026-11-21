import { useEffect, useRef, useState } from "react";

/** How often the playback position is read. */
const POLL_MS = 250;

/** Whole seconds of a position, so that a label re-renders once a second at most. */
function wholeSeconds(positionMs: number | null) {
  return positionMs === null ? null : Math.floor(positionMs / 1000) * 1000;
}

/**
 * The playback position, in whole seconds, as `readPositionMs` reports it (null while nothing
 * is loaded); kept current for labels such as "Anchor to 1:23".
 */
export function usePlaybackSecond(readPositionMs: () => number | null) {
  const read = useRef(readPositionMs);
  useEffect(() => {
    read.current = readPositionMs;
  });
  const [positionMs, setPositionMs] = useState(() => wholeSeconds(readPositionMs()));
  useEffect(() => {
    const timer = window.setInterval(() => setPositionMs(wholeSeconds(read.current())), POLL_MS);
    return () => window.clearInterval(timer);
  }, []);
  return positionMs;
}
