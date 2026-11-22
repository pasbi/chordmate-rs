import { describe, expect, it } from "vitest";
import { latestOnly } from "./latestOnly.ts";

/** A task that records its name when it starts and finishes when `finish` is called. */
function controlledTask(name: string, started: string[]) {
  let finish = () => {};
  const done = new Promise<void>((resolve) => {
    finish = resolve;
  });
  return {
    task: () => {
      started.push(name);
      return done;
    },
    finish: () => finish(),
  };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("latestOnly", () => {
  it("runs the first task at once and only the newest of those given meanwhile", async () => {
    const started: string[] = [];
    const run = latestOnly(() => {});
    const first = controlledTask("first", started);
    const second = controlledTask("second", started);
    const third = controlledTask("third", started);
    run(first.task);
    run(second.task);
    run(third.task);
    expect(started).toEqual(["first"]);
    first.finish();
    await flush();
    expect(started).toEqual(["first", "third"]);
    third.finish();
    await flush();
    const fourth = controlledTask("fourth", started);
    run(fourth.task);
    expect(started).toEqual(["first", "third", "fourth"]);
  });

  it("goes on after a failed task", async () => {
    const started: string[] = [];
    const errors: unknown[] = [];
    const run = latestOnly((err) => errors.push(err));
    run(() => Promise.reject(new Error("refused")));
    run(controlledTask("next", started).task);
    await flush();
    expect(errors).toHaveLength(1);
    expect(started).toEqual(["next"]);
  });
});
