import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import type { PlayerHandle } from "../components/SpotifyPlayer.tsx";
import { currentHeadingIndex, type ScrollPoint, scrollTopAt } from "../lib/autoScroll.ts";
import { isTypingTarget } from "../lib/isTypingTarget.ts";
import type { SectionAnchor } from "./useSectionAnchors.ts";

/** Where an anchored heading sits while its section plays: this far down the visible sheet. */
const HEADING_POSITION = 0.15;
/** How much of the remaining distance each frame covers when catching up, e.g. after a jump. */
const CATCH_UP = 0.15;
/** Closer than this, the sheet is put exactly in place. */
const SNAP_PX = 2;
const SCROLL_KEYS = new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"]);

/** The sheet's headings with their section keys and, if anchored, when their sections start. */
function sheetHeadings(container: HTMLElement, anchors: Map<string, SectionAnchor>) {
  return [...container.querySelectorAll<HTMLElement>("[data-section-key]")].map((element) => {
    const key = element.dataset.sectionKey ?? "";
    return { key, top: element.offsetTop, startMs: anchors.get(key)?.positionMs ?? null };
  });
}

/** The scroll positions at which anchored headings sit where they should while they play. */
function anchorPoints(container: HTMLElement, headings: ReturnType<typeof sheetHeadings>) {
  const offset = container.clientHeight * HEADING_POSITION;
  return headings.flatMap(({ top, startMs }): ScrollPoint[] =>
    startMs === null ? [] : [{ positionMs: startMs, scrollTop: top - offset }]
  );
}

/**
 * Scrolls the sheet along with the music while `active` (see lib/autoScroll.ts). Scrolling by
 * hand (wheel, touch, scroll bar, keys) pauses it, so that the sheet stays where it was put; it
 * resumes with `resume`, or once playback reaches an anchored section after the pause.
 * `currentSection` is the key of the section playing (see lib/autoScroll.ts), also while paused.
 */
export function useAutoScroll({
  active,
  containerRef,
  player,
  anchors,
}: {
  active: boolean;
  containerRef: RefObject<HTMLDivElement | null>;
  player: RefObject<PlayerHandle | null>;
  anchors: Map<string, SectionAnchor>;
}) {
  // The playback position when the user took over scrolling; null while following the music.
  const [pausedAt, setPausedAtState] = useState<number | null>(null);
  const pausedAtRef = useRef<number | null>(null);
  const setPausedAt = useCallback((positionMs: number | null) => {
    pausedAtRef.current = positionMs;
    setPausedAtState(positionMs);
  }, []);
  const resume = useCallback(() => setPausedAt(null), [setPausedAt]);
  const [currentSection, setCurrentSection] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!active || !container) {
      return;
    }
    const pause = () => {
      if (pausedAtRef.current === null) {
        setPausedAt(player.current?.now()?.positionMs ?? 0);
      }
    };
    // The scroll bar: a press on the scrolling element itself, not on its content.
    const onPointerDown = (event: PointerEvent) => {
      if (event.target === container) {
        pause();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (SCROLL_KEYS.has(event.key) && !isTypingTarget(event.target)) {
        pause();
      }
    };
    container.addEventListener("wheel", pause, { passive: true });
    container.addEventListener("touchmove", pause, { passive: true });
    container.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      container.removeEventListener("wheel", pause);
      container.removeEventListener("touchmove", pause);
      container.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [active, containerRef, player, setPausedAt]);

  useEffect(() => {
    if (!active) {
      return;
    }
    let frame = 0;
    const follow = () => {
      frame = requestAnimationFrame(follow);
      const container = containerRef.current;
      const now = player.current?.now() ?? null;
      if (!container || now === null) {
        return;
      }
      const headings = sheetHeadings(container, anchors);
      const current = currentHeadingIndex(
        now.positionMs,
        now.durationMs,
        headings,
        container.scrollHeight
      );
      // Only renders when the section changes.
      setCurrentSection(current === null ? null : headings[current].key);
      const paused = pausedAtRef.current;
      if (paused !== null) {
        const reachedAnchor = [...anchors.values()].some(
          (anchor) => anchor.positionMs > paused && anchor.positionMs <= now.positionMs
        );
        if (reachedAnchor) {
          setPausedAt(null);
        }
        return;
      }
      const maxScrollTop = container.scrollHeight - container.clientHeight;
      if (maxScrollTop <= 0) {
        return;
      }
      const points = anchorPoints(container, headings);
      const target = scrollTopAt(now.positionMs, now.durationMs, points, maxScrollTop);
      const distance = target - container.scrollTop;
      container.scrollTop += Math.abs(distance) <= SNAP_PX ? distance : distance * CATCH_UP;
    };
    frame = requestAnimationFrame(follow);
    return () => cancelAnimationFrame(frame);
  }, [active, containerRef, player, anchors, setPausedAt]);

  return { paused: active && pausedAt !== null, resume, currentSection };
}
