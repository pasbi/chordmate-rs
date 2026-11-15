import { useMetronome } from "../hooks/useMetronome";
import Button from "./Button.tsx";
import { INPUT_CLASSES } from "./inputClasses.ts";
import { forwardRef, useImperativeHandle, useState } from "react";

export type MetronomeHandle = {
  getBpm: () => number;
  setBpm: (bpm: number) => void;
  start: () => void;
  stop: () => void;
};

export const Metronome = forwardRef<MetronomeHandle>((_, ref) => {
  const [blink, setBlink] = useState(false);
  const { running, bpm, setBpm, start, stop, tap } = useMetronome(120, {
    onBeat: () => {
      setBlink(true);
      setTimeout(() => setBlink(false), 80);
    },
  });

  useImperativeHandle(
    ref,
    () => ({
      getBpm: () => bpm,
      setBpm,
      start,
      stop,
    }),
    [bpm, setBpm, start, stop]
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="primary" className="min-w-20" onClick={running ? stop : start}>
        {running ? "Stop" : "Start"}
      </Button>
      <label className="flex items-center gap-2">
        BPM
        <input
          type="number"
          value={bpm}
          min={30}
          max={300}
          onChange={(e) => setBpm(Number(e.target.value))}
          className={`w-20 ${INPUT_CLASSES}`}
        />
      </label>
      <Button variant={blink ? "success" : "secondary"} onClick={tap}>
        Tap
      </Button>
    </div>
  );
});
