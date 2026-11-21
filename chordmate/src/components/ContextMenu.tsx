import { type CSSProperties, type ReactNode, useEffect, useRef } from "react";
import { isTypingTarget } from "../lib/isTypingTarget";

export type ContextMenuItem = {
  label: string;
  danger: boolean;
  onSelect: () => void;
};

/** Where the menu's corner sits, so that it opens away from the nearest screen edges. */
function menuPosition(x: number, y: number): CSSProperties {
  const horizontal = x > window.innerWidth / 2 ? { right: window.innerWidth - x } : { left: x };
  const vertical = y > window.innerHeight / 2 ? { bottom: window.innerHeight - y } : { top: y };
  return { ...horizontal, ...vertical };
}

export const MENU_ITEM_CLASSES =
  "block w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 " +
  "focus-visible:outline-none focus-visible:bg-gray-100 dark:focus-visible:bg-gray-700";

/**
 * A menu (or a small dialog) at a screen position, with any content; closes on a click elsewhere,
 * Escape, scrolling or resizing. Focuses its first button, so that it can be used with the
 * keyboard.
 */
export function FloatingMenu({
  x,
  y,
  role,
  label,
  onClose,
  children,
}: {
  x: number;
  y: number;
  role: "menu" | "dialog";
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    menuRef.current?.querySelector("button")?.focus();
  }, []);

  useEffect(() => {
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) {
        onClose();
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    // Scrolling the page moves the menu's anchor away; scrolling a long menu itself doesn't.
    // Only from the second frame on: a scroll just before the menu opened (e.g. the sheet's
    // auto-scroll) is reported in the next frame, and must not close it.
    let scrollCloses = false;
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        scrollCloses = true;
      });
    });
    const closeOnOutsideScroll = (event: Event) => {
      const inMenu = event.target instanceof Node && menuRef.current?.contains(event.target);
      if (scrollCloses && !inMenu) {
        onClose();
      }
    };
    // On a phone, the on-screen keyboard resizes the window: typing must not close a dialog.
    const closeOnResize = () => {
      if (!isTypingTarget(document.activeElement)) {
        onClose();
      }
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    // Capturing, to also notice scrolling inside nested containers.
    window.addEventListener("scroll", closeOnOutsideScroll, true);
    window.addEventListener("resize", closeOnResize);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("scroll", closeOnOutsideScroll, true);
      window.removeEventListener("resize", closeOnResize);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      role={role}
      aria-label={label}
      style={menuPosition(x, y)}
      className="fixed z-50 min-w-40 max-h-[70vh] overflow-y-auto py-1 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
    >
      {children}
    </div>
  );
}

/** A menu at a pointer position with a list of actions. */
export function ContextMenu({
  x,
  y,
  items,
  onClose,
}: {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}) {
  return (
    <FloatingMenu x={x} y={y} role="menu" label="Actions" onClose={onClose}>
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          onClick={() => {
            onClose();
            item.onSelect();
          }}
          className={`${MENU_ITEM_CLASSES} ${item.danger ? "text-red-600 dark:text-red-400" : ""}`}
        >
          {item.label}
        </button>
      ))}
    </FloatingMenu>
  );
}
