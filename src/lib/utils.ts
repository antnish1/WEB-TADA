import type { CallEntry, DailyStatus, EngineerPlan } from "./types";

export const statusLabels: Record<DailyStatus, string> = {
  NOT_FILLED: "Not Filled",
  ONSITE: "Onsite",
  WORKSHOP: "Workshop",
  LEAVE: "Leave",
  ABSENT: "Absent",
  WEEKLY_OFF: "Weekly Off",
  TRAINING: "Training",
  MEETING: "Meeting",
  FREE: "Free / Available",
  OTHER: "Other"
};

export const workStatuses: DailyStatus[] = ["ONSITE", "WORKSHOP"];

export function createCall(status: DailyStatus = "ONSITE"): CallEntry {
  return {
    id: crypto.randomUUID(),
    workshopOnsite: status === "WORKSHOP" ? "Workshop" : "Onsite",
    callType: "U/W",
    engineerRole: "Primary Engineer",
    complaint: "",
    customerName: "",
    contactNumber: "",
    machineNo: "",
    hmr: "",
    breakdownStatus: "Running With Problem",
    machineModel: "",
    installationDate: "",
    siteLocation: "",
    deputationTime: "",
    expectedEndTime: "",
    callId: "",
    labourCharge: "",
    siteDistance: ""
  };
}

export function validatePlan(plan: EngineerPlan): string[] {
  const errors: string[] = [];
  if (plan.status === "NOT_FILLED") errors.push("Daily status is pending");
  if (workStatuses.includes(plan.status) && plan.calls.length === 0) errors.push("Add at least one call");
  plan.calls.forEach((call, index) => {
    const prefix = `Call ${index + 1}`;
    if (!call.complaint.trim()) errors.push(`${prefix}: complaint is required`);
    if (!call.customerName.trim()) errors.push(`${prefix}: customer is required`);
    if (!call.machineNo.trim()) errors.push(`${prefix}: machine number is required`);
    if (!call.deputationTime) errors.push(`${prefix}: planned time is required`);
    if (call.workshopOnsite === "Onsite" && !call.siteLocation.trim()) errors.push(`${prefix}: site location is required`);
  });
  return errors;
}

export function hasOverlap(calls: CallEntry[]): boolean {
  const timed = calls
    .filter((c) => c.deputationTime && c.expectedEndTime)
    .map((c) => ({ start: c.deputationTime, end: c.expectedEndTime }))
    .sort((a, b) => a.start.localeCompare(b.start));
  return timed.some((item, index) => index > 0 && item.start < timed[index - 1].end);
}
