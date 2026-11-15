export type Milliseconds = number & { readonly __unit: "ms" };
export type Seconds = number & { readonly __unit: "s" };

/** Formats a playback position or duration as `m:ss`. */
export function formatTime(duration: Milliseconds): string {
  const totalSeconds = (duration / 1000) as Seconds;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
