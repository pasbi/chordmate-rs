import * as React from "react";
import { useEffect } from "react";

type ModalProps = {
  label: string;
  children: React.ReactNode;
  onClose: () => void;
  className?: string; // extra classes for inner container
};

export function Modal({ label, children, onClose, className = "" }: ModalProps) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose} // click outside to close
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={`bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg shadow-lg w-full max-w-md flex flex-col max-h-[90vh] ${className}`}
        onClick={(e) => e.stopPropagation()} // prevent overlay click from closing when clicking inside modal
      >
        {children}
      </div>
    </div>
  );
}
