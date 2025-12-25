import { Dispatch, FormEvent, SetStateAction } from "react";
import { Condition, Field, RulePayload } from "../types";
import {
  createEmptyCondition,
  fieldLabels,
  selectValues,
} from "../constants/rules";

type RuleModalProps = {
  isOpen: boolean;
  editingId: string | null;
  formState: RulePayload;
  onChange: Dispatch<SetStateAction<RulePayload>>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
  submitting: boolean;
};

export function RuleModal({
  isOpen,
  editingId,
  formState,
  onChange,
  onSubmit,
  onClose,
  submitting,
}: RuleModalProps) {
  if (!isOpen) return null;

  const getDefaultStringValue = (field: Field) =>
    field === "department" ? "" : selectValues[field][0];

  const getDefaultValueForField = (field: Field, current?: string) => {
    if (field === "department") {
      return current ?? "";
    }

    const options = selectValues[field];
    if (current && options.includes(current)) {
      return current;
    }

    return getDefaultStringValue(field);
  };

  const updateCondition = (
    index: number,
    transform: (condition: Condition) => Condition
  ) => {
    onChange((prev) => ({
      ...prev,
      conditions: prev.conditions.map((condition, conditionIndex) =>
        conditionIndex === index ? transform(condition) : condition
      ),
    }));
  };

  const handleConditionFieldChange = (index: number, field: Field) => {
    updateCondition(index, (condition) => {
      const nextValue = getDefaultValueForField(field, condition.value);
      return { ...condition, field, op: "eq", value: nextValue };
    });
  };

  const handleConditionValueChange = (index: number, value: string) => {
    updateCondition(index, (condition) => {
      return { ...condition, op: "eq", value };
    });
  };

  const addCondition = () => {
    onChange((prev) => ({
      ...prev,
      conditions: [...prev.conditions, createEmptyCondition()],
    }));
  };

  const removeCondition = (index: number) => {
    onChange((prev) => {
      if (prev.conditions.length <= 1) {
        return prev;
      }
      return {
        ...prev,
        conditions: prev.conditions.filter(
          (_condition, conditionIndex) => conditionIndex !== index
        ),
      };
    });
  };

  const renderConditionValueInput = (condition: Condition, index: number) => {
    if (condition.field !== "department") {
      const options = selectValues[condition.field];
      return (
        <select
          value={condition.value}
          onChange={(event) => handleConditionValueChange(index, event.target.value)}
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    }

    return (
      <input
        type="text"
        value={condition.value}
        onChange={(event) => handleConditionValueChange(index, event.target.value)}
        placeholder="Value"
      />
    );
  };

  return (
    <div
      className="modal-overlay"
      onClick={() => {
        if (!submitting) onClose();
      }}
    >
      <div
        className="modal card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rule-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="card-header">
          <div>
            <h2 id="rule-dialog-title">{editingId ? "Edit Rule" : "New Rule"}</h2>
            <p>
              {editingId
                ? "Update the selected rule and save changes."
                : "Fill out the form to add a routing rule."}
            </p>
          </div>
          <button
            type="button"
            className="button ghost modal-close"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close dialog"
          >
            ×
          </button>
        </header>

        <form className="rule-form" onSubmit={onSubmit}>
          <label className="field">
            <span>Name</span>
            <input
              type="text"
              value={formState.name ?? ""}
              onChange={(event) =>
                onChange((prev) => ({
                  ...prev,
                  name: event.target.value,
                }))
              }
              placeholder="e.g. AU Sales -> John"
            />
          </label>

          <div className="field-inline">
            <label className="field checkbox">
              <input
                type="checkbox"
                checked={formState.enabled}
                onChange={(event) =>
                  onChange((prev) => ({
                    ...prev,
                    enabled: event.target.checked,
                  }))
                }
              />
              <span>Enabled</span>
            </label>

            <label className="field">
              <span>Priority</span>
              <input
                type="number"
                value={formState.priority}
                onChange={(event) =>
                  onChange((prev) => ({
                    ...prev,
                    priority: Number(event.target.value),
                  }))
                }
              />
            </label>
          </div>

          <div className="conditions">
            <div className="conditions-header">
              <span>Conditions</span>
              <button type="button" className="button ghost" onClick={addCondition}>
                Add condition
              </button>
            </div>

            {formState.conditions.map((condition, index) => (
              <div key={index} className="condition-row">
                <label>
                  <span className="sr-only">Field</span>
                  <select
                    value={condition.field}
                    onChange={(event) =>
                      handleConditionFieldChange(index, event.target.value as Field)
                    }
                  >
                    {Object.keys(fieldLabels).map((value) => (
                      <option key={value} value={value}>
                        {fieldLabels[value as Field]}
                      </option>
                    ))}
                  </select>
                </label>

                <span className="operator-label" aria-hidden="true">
                  =
                </span>

                <label>
                  <span className="sr-only">Value</span>
                  {renderConditionValueInput(condition, index)}
                </label>

                <button
                  type="button"
                  className="button danger ghost"
                  onClick={() => removeCondition(index)}
                  disabled={formState.conditions.length <= 1}
                  title="Remove condition"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <label className="field">
            <span>Assignee email</span>
            <input
              type="email"
              value={formState.action.value}
              onChange={(event) =>
                onChange((prev) => ({
                  ...prev,
                  action: { ...prev.action, value: event.target.value },
                }))
              }
              placeholder="owner@example.com"
            />
          </label>

          <div className="form-actions">
            <button
              type="button"
              className="button ghost"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button type="submit" className="button" disabled={submitting}>
              {submitting ? "Saving…" : editingId ? "Update rule" : "Create rule"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
