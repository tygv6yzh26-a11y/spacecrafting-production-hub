import { describe, expect, it } from "vitest";
import { defaultDeliveryText, normalizeStatus, parseDeliveryDate, stageOf, timingOf } from "./workflow";

describe("workflow rules", () => {
  it("default delivery is shoot date + 3 days, 'no later than 5PM'", () => {
    expect(defaultDeliveryText("2026-10-19")).toBe("Deliver by 10/22/2026 no later than 5PM");
  });
  it("deadline is parsed from the Delivery Date Range text; ranges use the last date", () => {
    expect(parseDeliveryDate("Deliver by 10/09/2026 no later than 5PM")).toBe("2026-10-09");
    expect(parseDeliveryDate("10/09/2026-10/12/2026")).toBe("2026-10-12");
  });
  it("falls back to shoot + 3 days when the text has no date", () => {
    expect(parseDeliveryDate("uploading", "2026-10-30")).toBe("2026-11-04");
  });
  it("footage-only status variants map to the shared dropdown value", () => {
    expect(normalizeStatus("Waiting on footage to be uploaded", "SVV")).toBe("Waiting on photos/footage to be uploaded");
  });
  it("E-soft statuses count as editing; Uploaded is past QC", () => {
    expect(stageOf("E-soft Editing AV")).toBe("editing");
    expect(stageOf("Uploaded")).toBe("qc_complete");
  });
  it("a job past its deadline is overdue unless delivered or canceled", () => {
    expect(timingOf({ status: "Editing", due_date: "2026-11-01" }, "2026-11-03")).toBe("overdue");
    expect(timingOf({ status: "Delivered / Invoiced", due_date: "2026-11-01" }, "2026-11-03")).toBe("none");
  });
  it("a job due tomorrow that hasn't started editing is at risk", () => {
    expect(timingOf({ status: "Ready to edit", due_date: "2026-11-04" }, "2026-11-03")).toBe("at_risk");
  });
});

import { countdownLabel, nextActions, urgencyRank } from "./workflow";
describe("cockpit rules", () => {
  it("counts down to the deadline", () => {
    expect(countdownLabel({ status: "Editing", due_date: "2026-11-04" }, "2026-11-06")).toBe("Overdue 2d");
    expect(countdownLabel({ status: "Editing", due_date: "2026-11-06" }, "2026-11-06")).toBe("Due today 5PM");
    expect(countdownLabel({ status: "Delivered", due_date: "2026-11-04" }, "2026-11-06")).toBeNull();
  });
  it("pins overdue before due today", () => {
    expect(urgencyRank({ status: "Editing", due_date: "2026-11-01" }, "2026-11-06")).toBeLessThan(
      urgencyRank({ status: "Editing", due_date: "2026-11-06" }, "2026-11-06"));
  });
  it("Needs QC offers Deliver and Revision", () => {
    expect(nextActions("Needs QC", "VE").map((a) => a.status)).toEqual(["Delivered", "Revision requested"]);
  });
});

import { isRush, buildBriefing } from "./workflow";
describe("rush + briefing", () => {
  it("flags deadlines tighter than shoot + 3 days as rush", () => {
    expect(isRush({ status: "Editing", shoot_date: "2026-11-06", due_date: "2026-11-07" })).toBe(true);
    expect(isRush({ status: "Editing", shoot_date: "2026-11-06", due_date: "2026-11-11" })).toBe(false);
    expect(isRush({ status: "Delivered", shoot_date: "2026-11-06", due_date: "2026-11-07" })).toBe(false);
  });
  it("lists overdue and unassigned jobs in the briefing", () => {
    const b = buildBriefing([
      { status: "Editing", due_date: "2026-11-05", shoot_date: "2026-11-02", editor: "Beau", address: "1 Lake Ave", project_name: null },
      { status: "Ready to edit", due_date: "2026-11-10", shoot_date: "2026-11-07", editor: null, address: "2 Grand Ave", project_name: null },
    ], "2026-11-07", "Sat Nov 7");
    expect(b).toContain("OVERDUE (1):\n• 1 Lake Ave — Beau");
    expect(b).toContain("UNASSIGNED (1):\n• 2 Grand Ave — Unassigned");
  });
});

describe("3 business day deadline", () => {
  it("skips weekends", async () => {
    const { defaultDueDate } = await import("./workflow");
    expect(defaultDueDate("2026-11-02")).toBe("2026-11-05"); // Mon -> Thu
    expect(defaultDueDate("2026-11-04")).toBe("2026-11-09"); // Wed -> Mon
    expect(defaultDueDate("2026-11-06")).toBe("2026-11-11"); // Fri -> Wed
    expect(defaultDueDate("2026-11-07")).toBe("2026-11-11"); // Sat -> Wed
    expect(defaultDueDate("2026-11-08")).toBe("2026-11-11"); // Sun -> Wed
  });
});

import { recentShootDates, capacityLevel } from "./workflow";
describe("recentShootDates", () => {
  it("uses yesterday on a Tuesday", () => expect(recentShootDates("2026-11-10")).toEqual(["2026-11-09"]));
  it("uses Fri–Sun on a Monday", () => expect(recentShootDates("2026-11-09")).toEqual(["2026-11-06", "2026-11-07", "2026-11-08"]));
});
describe("capacityLevel", () => {
  it("2 is light", () => expect(capacityLevel(2)).toBe("light"));
  it("3 is balanced", () => expect(capacityLevel(3)).toBe("balanced"));
  it("5 is heavy", () => expect(capacityLevel(5)).toBe("heavy"));
});
