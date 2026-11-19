/** Whether a key event is Ctrl+S (⌘S on a Mac), ChordMate's "save and finish". */
export function isSaveShortcut(event: KeyboardEvent) {
  return (event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "s";
}

/** Whether a key event's target takes text input, so that global keyboard shortcuts must ignore it. */
export function isTypingTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}
