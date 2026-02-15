import { useMetronome } from "../hooks/useMetronome";
import Button from "./Button.tsx";
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
    <div className="flex items-center gap-2 p-2 border rounded">
      <Button variant="primary" onClick={running ? stop : start}>
        {running ? "Stop" : "Start"}
      </Button>

      <label>
        BPM:
        <input
          type="number"
          value={bpm}
          min={30}
          max={300}
          onChange={(e) => setBpm(Number(e.target.value))}
          className="ml-1 w-16 px-1 border rounded"
        />
      </label>
      <Button
        variant="secondary"
        onClick={tap}
        className={`transition-colors duration-100 ${blink ? "bg-green-500" : "bg-gray-300"}`}
      >
        Tap
      </Button>
    </div>
  );
});
