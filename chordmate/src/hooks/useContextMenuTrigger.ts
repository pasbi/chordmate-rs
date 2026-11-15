import { type MouseEvent, type PointerEvent, useRef } from "react";

const LONG_PRESS_MS = 500;
const MOVE_TOLERANCE_PX = 10;

/**
 * Event handlers that call `open` with the pointer position on a right-click, and on a long
 * press with a finger. The long press has its own timer because iOS Safari sends no
 * contextmenu event for touch. Moving the finger (scrolling) cancels it, and a long press
 * doesn't also trigger a click when the finger is lifted.
 */
export function useContextMenuTrigger(open: (x: number, y: number) => void) {
  const timer = useRef<number | null>(null);
  const pressStart = useRef<{ x: number; y: number } | null>(null);
  const opened = useRef(false);

  const cancelLongPress = () => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    pressStart.current = null;
  };

  return {
    onPointerDown: (event: PointerEvent) => {
      opened.current = false;
      if (event.pointerType !== "touch") {
        return;
      }
      const { clientX: x, clientY: y } = event;
      pressStart.current = { x, y };
      timer.current = window.setTimeout(() => {
        opened.current = true;
        open(x, y);
      }, LONG_PRESS_MS);
    },
    onPointerMove: (event: PointerEvent) => {
      const start = pressStart.current;
      if (
        start &&
        Math.hypot(event.clientX - start.x, event.clientY - start.y) > MOVE_TOLERANCE_PX
      ) {
        cancelLongPress();
      }
    },
    onPointerUp: cancelLongPress,
    onPointerCancel: cancelLongPress,
    onContextMenu: (event: MouseEvent) => {
      event.preventDefault();
      cancelLongPress();
      opened.current = true;
      open(event.clientX, event.clientY);
    },
    onClick: (event: MouseEvent) => {
      if (opened.current) {
        event.preventDefault();
        opened.current = false;
      }
    },
  };
}
