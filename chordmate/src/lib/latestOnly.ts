/**
 * Runs tasks one at a time where only the newest matters, e.g. jumping to a position shifted by
 * repeated presses: a task given while one runs waits, and replaces any task already waiting.
 * So quick presses end in the last one, without working through all those in between.
 */
export function latestOnly(onError: (err: unknown) => void) {
  let running = false;
  let waiting: (() => Promise<void>) | null = null;

  const runWaiting = () => {
    const task = waiting;
    waiting = null;
    if (task === null) {
      running = false;
      return;
    }
    running = true;
    task().catch(onError).finally(runWaiting);
  };

  return (task: () => Promise<void>) => {
    waiting = task;
    if (!running) {
      runWaiting();
    }
  };
}
