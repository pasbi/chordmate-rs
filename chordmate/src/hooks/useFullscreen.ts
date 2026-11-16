import { useCallback, useEffect, useState } from "react";

function isFullscreen() {
  return document.fullscreenElement !== null;
}

/**
 * Shows the whole app fullscreen, without the browser's and the system's bars. It is never
 * entered by itself: browsers only allow it on a tap. It lasts while moving between pages of the
 * app, since they don't reload it, until it is toggled off, or left by the system's back gesture.
 */
export function useFullscreen() {
  const [active, setActive] = useState(isFullscreen);

  useEffect(() => {
    const onChange = () => setActive(isFullscreen());
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggle = useCallback(() => {
    const change = isFullscreen()
      ? document.exitFullscreen()
      : document.documentElement.requestFullscreen({ navigationUI: "hide" });
    change.catch((err: unknown) => console.warn("Could not toggle fullscreen.", err));
  }, []);

  return { supported: document.fullscreenEnabled, active, toggle };
}
