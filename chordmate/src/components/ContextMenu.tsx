import { type CSSProperties, useEffect, useRef } from "react";

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

/** A menu at a pointer position; closes on a click elsewhere, Escape, scrolling or resizing. */
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
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    // Capturing, to also notice scrolling inside nested containers.
    window.addEventListener("scroll", onClose, true);
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("scroll", onClose, true);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      role="menu"
      style={menuPosition(x, y)}
      className="fixed z-50 min-w-40 py-1 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          onClick={() => {
            onClose();
            item.onSelect();
          }}
          className={`block w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 focus-visible:outline-none focus-visible:bg-gray-100 dark:focus-visible:bg-gray-700 ${item.danger ? "text-red-600 dark:text-red-400" : ""}`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
