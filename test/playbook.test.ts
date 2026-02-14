import { describe, it, expect } from "vitest";
import { calculateRecoveryProgress, recoveryTasks, emergencyPlaybook, KILLER_PITCH_LINE } from "../src/core/playbook";

describe("calculateRecoveryProgress", () => {
  it("returns 0 when no tasks completed", () => {
    expect(calculateRecoveryProgress([])).toBe(0);
  });

  it("returns 100 when all tasks completed", () => {
    const allIds = recoveryTasks.map((t) => t.id);
    expect(calculateRecoveryProgress(allIds)).toBe(100);
  });

  it("ignores unknown task IDs", () => {
    expect(calculateRecoveryProgress(["nonexistent_task", "another_fake"])).toBe(0);
  });

  it("calculates correct partial progress", () => {
    // bank_freeze has weight 20
    expect(calculateRecoveryProgress(["bank_freeze"])).toBe(20);
  });

  it("sums weights correctly for multiple tasks", () => {
    // bank_freeze (20) + revoke_approvals (20) = 40
    expect(calculateRecoveryProgress(["bank_freeze", "revoke_approvals"])).toBe(40);
  });

  it("caps at 100 even with duplicate IDs", () => {
    const allIds = recoveryTasks.map((t) => t.id);
    const doubled = [...allIds, ...allIds];
    expect(calculateRecoveryProgress(doubled)).toBe(100);
  });
});

describe("recoveryTasks", () => {
  it("has 6 tasks", () => {
    expect(recoveryTasks).toHaveLength(6);
  });

  it("task weights sum to 100", () => {
    const sum = recoveryTasks.reduce((acc, t) => acc + t.weight, 0);
    expect(sum).toBe(100);
  });

  it("each task has required fields", () => {
    for (const task of recoveryTasks) {
      expect(task.id).toBeTruthy();
      expect(task.label).toBeTruthy();
      expect(task.weight).toBeGreaterThan(0);
      expect(task.why).toBeTruthy();
    }
  });
});

describe("emergencyPlaybook", () => {
  it("has stopBleeding steps", () => {
    expect(emergencyPlaybook.stopBleeding.length).toBeGreaterThan(0);
  });

  it("has collectEvidence steps", () => {
    expect(emergencyPlaybook.collectEvidence.length).toBeGreaterThan(0);
  });

  it("has reportChannels", () => {
    expect(emergencyPlaybook.reportChannels.length).toBeGreaterThan(0);
  });

  it("includes NSRC 997 in stopBleeding", () => {
    const hasNSRC = emergencyPlaybook.stopBleeding.some((s) => s.includes("997"));
    expect(hasNSRC).toBe(true);
  });

  it("has legal disclaimer", () => {
    expect(emergencyPlaybook.legalLine).toContain("recovery");
  });
});

describe("KILLER_PITCH_LINE", () => {
  it("is non-empty", () => {
    expect(KILLER_PITCH_LINE.length).toBeGreaterThan(0);
  });
});
