import { useEffect } from "react";

const USER_GESTURES = ["click", "touchend", "keydown"] as const;

/** Uses the Screen Wake Lock API, which browsers only offer on secure origins (HTTPS, localhost). */
function keepOnWithWakeLock(wakeLock: WakeLock) {
  let sentinel: WakeLockSentinel | null = null;
  let stopped = false;

  const request = async () => {
    if (document.visibilityState !== "visible") {
      return;
    }
    try {
      sentinel = await wakeLock.request("screen");
      if (stopped) {
        await sentinel.release();
      }
    } catch (err) {
      console.warn("Could not keep the screen on.", err);
    }
  };

  // The browser releases the lock whenever the page is hidden, so request it again on return.
  const onVisibilityChange = () => void request();
  document.addEventListener("visibilitychange", onVisibilityChange);
  void request();

  return () => {
    stopped = true;
    document.removeEventListener("visibilitychange", onVisibilityChange);
    void sentinel?.release();
  };
}

/**
 * Fallback for plain-HTTP origins such as http://<laptop-ip>: a playing video keeps most mobile
 * browsers from turning off the screen. Browsers only start it reliably after a user gesture.
 */
function keepOnWithVideo() {
  const video = document.createElement("video");
  video.src = "/keep-awake.mp4";
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  Object.assign(video.style, {
    position: "fixed",
    left: "0",
    bottom: "0",
    width: "1px",
    height: "1px",
    opacity: "0.01",
    pointerEvents: "none",
  });
  document.body.appendChild(video);

  const removeGestureListeners = () => {
    USER_GESTURES.forEach((gesture) => document.removeEventListener(gesture, play));
  };
  function play() {
    video
      .play()
      .then(removeGestureListeners)
      .catch(() => {
        // Not allowed yet; the next user gesture tries again.
      });
  }
  USER_GESTURES.forEach((gesture) => document.addEventListener(gesture, play));
  play();

  return () => {
    removeGestureListeners();
    video.pause();
    video.remove();
  };
}

/** Prevents the screen from turning off while `active`. */
export function useKeepScreenOn(active: boolean) {
  useEffect(() => {
    if (!active) {
      return;
    }
    return "wakeLock" in navigator ? keepOnWithWakeLock(navigator.wakeLock) : keepOnWithVideo();
  }, [active]);
}
