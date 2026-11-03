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
    expect(parseDeliveryDate("uploading", "2026-10-30")).toBe("2026-11-02");
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
