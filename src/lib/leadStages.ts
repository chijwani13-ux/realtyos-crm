export const LEAD_STAGES = [
  "Lead",
  "First Call",
  "Follow-up Call",
  "Qualification",
  "Consultation",
  "Site Visit Scheduled",
  "Site Visit Done",
  "Negotiation",
  "Booked",
  "Registration",
  "Closed",
] as const;

function stageIndex(stage: string): number {
  return LEAD_STAGES.indexOf(stage as (typeof LEAD_STAGES)[number]);
}

// Budget must be captured before a lead can be considered "qualified" —
// enforced from Qualification onward.
export function stageRequiresBudget(stage: string): boolean {
  return stageIndex(stage) >= stageIndex("Qualification");
}
