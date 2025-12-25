import { Condition, Field, RulePayload } from "../types";

export const fieldLabels: Record<Field, string> = {
  contractType: "Contract Type",
  location: "Location",
  department: "Department",
};

export const selectValues: Record<Exclude<Field, "department">, string[]> = {
  contractType: ["Sales", "Employment", "NDA"],
  location: ["Australia", "United States"],
};

export const createEmptyCondition = (field: Field = "contractType"): Condition => ({
  field,
  op: "eq",
  value: field === "department" ? "" : selectValues[field][0],
});

export const createInitialRule = (): RulePayload => ({
  name: "",
  enabled: true,
  priority: 0,
  conditions: [createEmptyCondition()],
  action: { type: "assign_email", value: "" },
});

export const formatCondition = (condition: Condition) => {
  const label = fieldLabels[condition.field];
  return `${label} = ${condition.value}`;
};
