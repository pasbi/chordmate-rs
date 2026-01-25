import * as React from "react";

type ModalProps = {
  children: React.ReactNode;
  onClose?: () => void;
  className?: string; // extra classes for inner container
};

export function Modal({ children, onClose, className = "" }: ModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose} // click outside to close
    >
      <div
        className={`bg-white dark:bg-gray-900 rounded-lg shadow-lg w-full max-w-md flex flex-col h-full max-h-[90vh] ${className}`}
        onClick={(e) => e.stopPropagation()} // prevent overlay click from closing when clicking inside modal
      >
        {children}
      </div>
    </div>
  );
}
