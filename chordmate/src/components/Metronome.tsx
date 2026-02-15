import { useMetronome } from "../hooks/useMetronome";
import Button from "./Button.tsx";

export function Metronome() {
  const { running, bpm, setBpm, start, stop, tap } = useMetronome(100);

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
      <Button variant="secondary" onClick={tap}>
        Tap
      </Button>
    </div>
  );
}
