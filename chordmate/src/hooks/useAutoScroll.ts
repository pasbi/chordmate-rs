import { type RefObject, useEffect, useState } from "react";
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
/** A finger moving less than this is a tap (e.g. on a heading's button), not scrolling. */
const TOUCH_SLOP_PX = 10;
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
 * hand (wheel, touch, scroll bar, keys) calls `onManualScroll`, which is meant to switch it off,
 * so that the sheet stays where it was put. Returns the key of the section playing.
 */
export function useAutoScroll({
  active,
  containerRef,
  player,
  anchors,
  onManualScroll,
}: {
  active: boolean;
  containerRef: RefObject<HTMLDivElement | null>;
  player: RefObject<PlayerHandle | null>;
  anchors: Map<string, SectionAnchor>;
  onManualScroll: () => void;
}) {
  const [currentSection, setCurrentSection] = useState<string | null>(null);

  // On the document, checking the sheet when it happens: the sheet may mount after this runs.
  useEffect(() => {
    if (!active) {
      return;
    }
    const inSheet = (target: EventTarget | null) =>
      target instanceof Node && containerRef.current?.contains(target) === true;
    const onWheel = (event: WheelEvent) => {
      if (inSheet(event.target)) {
        onManualScroll();
      }
    };
    let touchStartY = 0;
    const onTouchStart = (event: TouchEvent) => {
      touchStartY = event.touches[0]?.clientY ?? 0;
    };
    const onTouchMove = (event: TouchEvent) => {
      const y = event.touches[0]?.clientY ?? touchStartY;
      if (inSheet(event.target) && Math.abs(y - touchStartY) > TOUCH_SLOP_PX) {
        onManualScroll();
      }
    };
    // The scroll bar: a press on the scrolling element itself, not on its content.
    const onPointerDown = (event: PointerEvent) => {
      if (event.target === containerRef.current) {
        onManualScroll();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (SCROLL_KEYS.has(event.key) && !isTypingTarget(event.target)) {
        onManualScroll();
      }
    };
    document.addEventListener("wheel", onWheel, { passive: true });
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("wheel", onWheel);
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [active, containerRef, onManualScroll]);

  useEffect(() => {
    if (!active) {
      return;
    }
    // Held still while a finger or the mouse is down on the sheet, so that a tap on a heading's
    // button lands where it was aimed.
    let pressing = false;
    const onPress = (event: PointerEvent) => {
      pressing =
        event.target instanceof Node && containerRef.current?.contains(event.target) === true;
    };
    const onRelease = () => {
      pressing = false;
    };
    document.addEventListener("pointerdown", onPress);
    document.addEventListener("pointerup", onRelease);
    document.addEventListener("pointercancel", onRelease);
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
      const maxScrollTop = container.scrollHeight - container.clientHeight;
      if (maxScrollTop <= 0 || pressing) {
        return;
      }
      const points = anchorPoints(container, headings);
      const target = scrollTopAt(now.positionMs, now.durationMs, points, maxScrollTop);
      const distance = target - container.scrollTop;
      container.scrollTop += Math.abs(distance) <= SNAP_PX ? distance : distance * CATCH_UP;
    };
    frame = requestAnimationFrame(follow);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", onPress);
      document.removeEventListener("pointerup", onRelease);
      document.removeEventListener("pointercancel", onRelease);
    };
  }, [active, containerRef, player, anchors]);

  return currentSection;
}
