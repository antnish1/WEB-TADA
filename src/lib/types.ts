export type DailyStatus = "NOT_FILLED" | "ONSITE" | "WORKSHOP" | "LEAVE" | "ABSENT" | "WEEKLY_OFF" | "TRAINING" | "MEETING" | "FREE" | "OTHER";

export type CallEntry = {
  id: string;
  workshopOnsite: "Onsite" | "Workshop";
  callType: string;
  engineerRole: "Primary Engineer" | "Secondary Engineer";
  complaint: string;
  customerName: string;
  contactNumber: string;
  machineNo: string;
  hmr: string;
  breakdownStatus: string;
  machineModel: string;
  installationDate: string;
  siteLocation: string;
  deputationTime: string;
  expectedEndTime: string;
  callId: string;
  labourCharge: string;
  siteDistance: string;
};

export type EngineerPlan = {
  engineerName: string;
  status: DailyStatus;
  remarks: string;
  expanded: boolean;
  calls: CallEntry[];
};
