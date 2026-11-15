import { type ReactNode, useEffect, useRef, useState } from "react";

type PopoverProps = {
  label: string;
  /** Renders the button that opens and closes the popover. */
  renderTrigger: (toggle: () => void, open: boolean) => ReactNode;
  children: ReactNode;
};

/**
 * A small panel that opens below the nearest positioned ancestor (give the surrounding toolbar
 * `relative`), near its right edge, so that it fits the screen wherever the trigger sits.
 * Closes on a click elsewhere or on Escape. The panel stays mounted while closed, so its contents
 * keep their state (e.g. a running metronome).
 */
export function Popover({ label, renderTrigger, children }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !containerRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={containerRef}>
      {renderTrigger(() => setOpen(!open), open)}
      <div
        role="dialog"
        aria-label={label}
        hidden={!open}
        className="absolute right-2 top-full mt-1 z-20 w-max p-2 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
      >
        {children}
      </div>
    </div>
  );
}
