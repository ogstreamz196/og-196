import { describe, expect, it } from "vitest";
import { computeWatch } from "./generation-watch";

const T0 = 1_700_000_000_000;
const TASK = "task-123";

describe("computeWatch", () => {
  it("returns idle when no task is being watched", () => {
    expect(computeWatch({ taskId: null, startedAt: null, now: T0, songs: [] }).state).toBe("idle");
  });

  it("stays watching while no matching song exists yet (0–30s)", () => {
    const r = computeWatch({
      taskId: TASK,
      startedAt: T0,
      now: T0 + 10_000,
      songs: [{ suno_task_id: "other", status: "completed" }],
    });
    expect(r.state).toBe("watching");
  });

  it("stays watching while clips are still processing", () => {
    const r = computeWatch({
      taskId: TASK,
      startedAt: T0,
      now: T0 + 45_000,
      expectedCount: 2,
      songs: [
        { suno_task_id: TASK, status: "processing" },
        { suno_task_id: TASK, status: "processing" },
      ],
    });
    expect(r.state).toBe("watching");
  });

  it("reports completed only when ALL expected clips finished", () => {
    const partial = computeWatch({
      taskId: TASK,
      startedAt: T0,
      now: T0 + 60_000,
      expectedCount: 2,
      songs: [
        { suno_task_id: TASK, status: "completed" },
        { suno_task_id: TASK, status: "processing" },
      ],
    });
    expect(partial.state).toBe("watching");

    const done = computeWatch({
      taskId: TASK,
      startedAt: T0,
      now: T0 + 95_000,
      expectedCount: 2,
      songs: [
        { suno_task_id: TASK, status: "completed" },
        { suno_task_id: TASK, status: "completed" },
      ],
    });
    expect(done.state).toBe("completed");
    expect(done.matched).toHaveLength(2);
  });

  it("surfaces failed status with error message", () => {
    const r = computeWatch({
      taskId: TASK,
      startedAt: T0,
      now: T0 + 20_000,
      songs: [{ suno_task_id: TASK, status: "failed", error_message: "Suno boom" }],
    });
    expect(r.state).toBe("failed");
    expect(r.errorMessage).toBe("Suno boom");
  });

  it("times out past the 180s ceiling so the UI can never get stuck", () => {
    const r = computeWatch({
      taskId: TASK,
      startedAt: T0,
      now: T0 + 200_000,
      songs: [{ suno_task_id: TASK, status: "processing" }],
    });
    expect(r.state).toBe("timeout");
  });

  it("respects a custom timeout", () => {
    const r = computeWatch({
      taskId: TASK,
      startedAt: T0,
      now: T0 + 15_000,
      timeoutMs: 10_000,
      songs: [{ suno_task_id: TASK, status: "processing" }],
    });
    expect(r.state).toBe("timeout");
  });
});
