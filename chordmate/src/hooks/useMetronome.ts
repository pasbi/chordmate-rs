import { useEffect, useRef, useState } from "react";

export function useMetronome(initialBpm: number) {
  const [running, setRunning] = useState(false);
  const [bpm, setBpm] = useState(initialBpm);
  const bpmRef = useRef(bpm);
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextClickTimeRef = useRef<number>(0);
  const schedulerTimeoutRef = useRef<number | null>(null);
  const tapTimes = useRef<number[]>([]);

  useEffect(() => {
    bpmRef.current = bpm;
  }, [bpm]);

  function playClickAt(context: AudioContext, time: number) {
    const osc = context.createOscillator();
    const gain = context.createGain();

    osc.frequency.value = 1000;
    osc.type = "square";
    gain.gain.value = 0.2;

    osc.connect(gain);
    gain.connect(context.destination);

    osc.start(time);
    osc.stop(time + 0.05);
  }

  function scheduler() {
    if (!audioContextRef.current) return;
    const context = audioContextRef.current;
    const lookahead = 25 / 1000; // 25 ms
    const scheduleAheadTime = 0.1; // seconds

    while (nextClickTimeRef.current < context.currentTime + scheduleAheadTime) {
      playClickAt(context, nextClickTimeRef.current);
      nextClickTimeRef.current += 60 / bpmRef.current;
    }

    schedulerTimeoutRef.current = window.setTimeout(scheduler, lookahead * 1000);
  }

  function start() {
    if (!audioContextRef.current) audioContextRef.current = new AudioContext();
    nextClickTimeRef.current = audioContextRef.current.currentTime;
    setRunning(true);
    scheduler();
  }

  function stop() {
    if (schedulerTimeoutRef.current) {
      clearTimeout(schedulerTimeoutRef.current);
    }
    setRunning(false);
  }

  function tap() {
    const now = performance.now();
    tapTimes.current.push(now);

    // keep last 5 taps
    if (tapTimes.current.length > 5) tapTimes.current.shift();

    if (tapTimes.current.length >= 2) {
      const intervals = tapTimes.current.slice(1).map((t, i) => t - tapTimes.current[i]);
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const newBpm = Math.round(60000 / avgInterval);
      setBpm(newBpm);
      stop();
      start();
    }
  }

  return {
    running,
    bpm,
    setBpm,
    start,
    stop,
    tap,
  };
}
