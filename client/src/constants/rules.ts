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
  operator: "equals",
  value: field === "department" ? "" : selectValues[field][0],
});

export const createInitialRule = (): RulePayload => ({
  name: "",
  enabled: true,
  priority: 0,
  conditions: [createEmptyCondition()],
  assigneeEmail: "",
});

export const formatCondition = (condition: Condition) =>
  `${fieldLabels[condition.field]} = ${condition.value}`;
