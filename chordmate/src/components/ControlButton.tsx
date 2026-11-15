import type { ReactNode } from "react";

type ControlButtonVariant = "primary" | "secondary";

const BASE_CLASSES =
  "h-8 px-1.5 flex items-center justify-center text-sm font-medium tabular-nums " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500";

const VARIANT_CLASSES: Record<ControlButtonVariant, string> = {
  primary: "min-w-12 bg-blue-500 hover:bg-blue-600 text-white",
  secondary: "min-w-9 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600",
};

/** A compact button of the player's control row. */
export function ControlButton({
  onClick,
  title,
  variant,
  children,
}: {
  onClick: () => void;
  title: string;
  variant: ControlButtonVariant;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`${BASE_CLASSES} rounded ${VARIANT_CLASSES[variant]}`}
    >
      {children}
    </button>
  );
}

/**
 * A control button with an attached ▾ part that opens a menu, like a tool button with a menu. The
 * ▾ part stays wide enough to hit with a finger.
 */
export function SplitControlButton({
  onClick,
  title,
  menuTitle,
  menuOpen,
  onOpenMenu,
  children,
}: {
  onClick: () => void;
  title: string;
  menuTitle: string;
  menuOpen: boolean;
  /** Gets the ▾ part's position on screen, to open the menu below it. */
  onOpenMenu: (anchor: DOMRect) => void;
  children: ReactNode;
}) {
  return (
    <div className="flex">
      <button
        type="button"
        title={title}
        onClick={onClick}
        className={`${BASE_CLASSES} rounded-l ${VARIANT_CLASSES.secondary}`}
      >
        {children}
      </button>
      <button
        type="button"
        title={menuTitle}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        // While the menu is open, a press here must only close it: without this, the menu's
        // "pressed elsewhere" handling would close it first and the click would open it again.
        onPointerDown={(event) => {
          if (menuOpen) {
            event.stopPropagation();
          }
        }}
        onClick={(event) => onOpenMenu(event.currentTarget.getBoundingClientRect())}
        className={`${BASE_CLASSES} min-w-7 rounded-r border-l border-gray-300 dark:border-gray-600 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600`}
      >
        ▾
      </button>
    </div>
  );
}
