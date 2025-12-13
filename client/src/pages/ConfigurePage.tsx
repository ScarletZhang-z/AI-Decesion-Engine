import { FormEvent, useEffect, useMemo, useState } from "react";
import { createRule, deleteRule, fetchRules, updateRule } from "../api";
import { Condition, Field, Rule, RulePayload } from "../types";

const fieldLabels: Record<Field, string> = {
  contractType: "Contract Type",
  location: "Location",
  department: "Department",
};

const selectValues: Record<Exclude<Field, "department">, string[]> = {
  contractType: ["Sales", "Employment", "NDA"],
  location: ["Australia", "United States"],
};

const createEmptyCondition = (field: Field = "contractType"): Condition => ({
  field,
  operator: "equals",
  value: field === "department" ? "" : selectValues[field][0],
});

const createInitialRule = (): RulePayload => ({
  name: "",
  enabled: true,
  priority: 0,
  conditions: [createEmptyCondition()],
  assigneeEmail: "",
});

const formatCondition = (condition: Condition) =>
  `${fieldLabels[condition.field]} = ${condition.value}`;

export default function ConfigurePage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [formState, setFormState] = useState<RulePayload>(createInitialRule());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const sortedRules = useMemo(
    () =>
      [...rules].sort((a, b) => {
        if (a.priority === b.priority) {
          return a.name.localeCompare(b.name);
        }
        return b.priority - a.priority;
      }),
    [rules]
  );

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchRules();
        setRules(data);
      } catch (caughtError) {
        const message =
          caughtError instanceof Error
            ? caughtError.message
            : "Failed to load rules";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const resetForm = () => {
    setFormState(createInitialRule());
    setEditingId(null);
    setMessage(null);
    setError(null);
  };

  const handleConditionFieldChange = (index: number, field: Field) => {
    setFormState((prev) => {
      const nextConditions = prev.conditions.map((condition, conditionIndex) => {
        if (conditionIndex !== index) return condition;
        const nextValue = field === "department" ? "" : selectValues[field][0];
        return { ...condition, field, value: nextValue };
      });
      return { ...prev, conditions: nextConditions };
    });
  };

  const handleConditionValueChange = (index: number, value: string) => {
    setFormState((prev) => {
      const nextConditions = prev.conditions.map((condition, conditionIndex) =>
        conditionIndex === index ? { ...condition, value } : condition
      );
      return { ...prev, conditions: nextConditions };
    });
  };

  const addCondition = () => {
    setFormState((prev) => ({
      ...prev,
      conditions: [...prev.conditions, createEmptyCondition()],
    }));
  };

  const removeCondition = (index: number) => {
    setFormState((prev) => {
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

  const startEdit = (rule: Rule) => {
    setEditingId(rule.id);
    setFormState({
      name: rule.name,
      enabled: rule.enabled,
      priority: rule.priority,
      conditions: rule.conditions.map((condition) => ({ ...condition })),
      assigneeEmail: rule.assigneeEmail,
    });
    setMessage(null);
    setError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);

    const sanitizedConditions = formState.conditions.map((condition) => ({
      ...condition,
      value: condition.value.trim(),
    }));

    const payload: RulePayload = {
      ...formState,
      name: formState.name.trim(),
      assigneeEmail: formState.assigneeEmail.trim(),
      priority: Number(formState.priority),
      conditions: sanitizedConditions,
    };

    if (!payload.name) {
      setError("Rule name is required.");
      setSubmitting(false);
      return;
    }

    if (!payload.assigneeEmail) {
      setError("Assignee email is required.");
      setSubmitting(false);
      return;
    }

    if (!Number.isFinite(payload.priority)) {
      setError("Priority must be a number.");
      setSubmitting(false);
      return;
    }

    if (!payload.conditions.length) {
      setError("At least one condition is required.");
      setSubmitting(false);
      return;
    }

    if (payload.conditions.some((condition) => !condition.value)) {
      setError("Please complete all condition values.");
      setSubmitting(false);
      return;
    }

    try {
      if (editingId) {
        const updated = await updateRule(editingId, payload);
        setRules((prev) =>
          prev.map((rule) => (rule.id === editingId ? updated : rule))
        );
        setMessage("Rule updated.");
      } else {
        const created = await createRule(payload);
        setRules((prev) => [...prev, created]);
        setMessage("Rule created.");
      }
      setEditingId(null);
      setFormState(createInitialRule());
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to save rule";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (rule: Rule) => {
    const confirmed = window.confirm(
      `Delete rule "${rule.name}"? This cannot be undone.`
    );
    if (!confirmed) return;

    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      await deleteRule(rule.id);
      setRules((prev) => prev.filter((item) => item.id !== rule.id));
      if (editingId === rule.id) {
        resetForm();
      }
      setMessage("Rule deleted.");
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to delete rule";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const renderConditionValueInput = (condition: Condition, index: number) => {
    if (condition.field === "department") {
      return (
        <input
          type="text"
          value={condition.value}
          onChange={(event) =>
            handleConditionValueChange(index, event.target.value)
          }
          placeholder="Department"
        />
      );
    }

    const options = selectValues[condition.field];

    return (
      <select
        value={condition.value}
        onChange={(event) =>
          handleConditionValueChange(index, event.target.value)
        }
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  };

  return (
    <div className="configure-page">
      <div className="configure-header">
        <div>
          <h1>Rules</h1>
          <p>
            Define routing rules based on contract type, location, and
            department.
          </p>
        </div>
        <button className="button" type="button" onClick={resetForm}>
          New Rule
        </button>
      </div>

      {(error || message) && (
        <div className={`notice ${error ? "notice-error" : "notice-success"}`}>
          {error || message}
        </div>
      )}

      <div className="configure-grid">
        <section className="card">
          <header className="card-header">
            <div>
              <h2>Existing Rules</h2>
              <p>Click edit to modify or remove a rule.</p>
            </div>
            <span className="badge">{rules.length} total</span>
          </header>

          {loading ? (
            <p className="muted">Loading rules…</p>
          ) : sortedRules.length === 0 ? (
            <p className="muted">No rules yet. Create your first rule.</p>
          ) : (
            <div className="table-wrapper">
              <table className="rules-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Status</th>
                    <th>Priority</th>
                    <th>Conditions</th>
                    <th>Assignee</th>
                    <th aria-label="actions" />
                  </tr>
                </thead>
                <tbody>
                  {sortedRules.map((rule) => (
                    <tr key={rule.id}>
                      <td>{rule.name}</td>
                      <td>
                        <span
                          className={`pill ${
                            rule.enabled ? "pill-success" : "pill-muted"
                          }`}
                        >
                          {rule.enabled ? "Enabled" : "Disabled"}
                        </span>
                      </td>
                      <td>{rule.priority}</td>
                      <td className="conditions-cell">
                        {rule.conditions.map(formatCondition).join(" · ")}
                      </td>
                      <td>{rule.assigneeEmail}</td>
                      <td className="actions-cell">
                        <button
                          type="button"
                          className="button ghost"
                          onClick={() => startEdit(rule)}
                          disabled={submitting}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="button danger"
                          onClick={() => handleDelete(rule)}
                          disabled={submitting}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card">
          <header className="card-header">
            <div>
              <h2>{editingId ? "Edit Rule" : "New Rule"}</h2>
              <p>
                {editingId
                  ? "Update the selected rule and save changes."
                  : "Fill out the form to add a routing rule."}
              </p>
            </div>
          </header>

          <form className="rule-form" onSubmit={handleSubmit}>
            <label className="field">
              <span>Name</span>
              <input
                type="text"
                value={formState.name}
                onChange={(event) =>
                  setFormState((prev) => ({
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
                    setFormState((prev) => ({
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
                    setFormState((prev) => ({
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
                <button
                  type="button"
                  className="button ghost"
                  onClick={addCondition}
                >
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
                        handleConditionFieldChange(
                          index,
                          event.target.value as Field
                        )
                      }
                    >
                      {Object.keys(fieldLabels).map((value) => (
                        <option key={value} value={value}>
                          {fieldLabels[value as Field]}
                        </option>
                      ))}
                    </select>
                  </label>

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
                value={formState.assigneeEmail}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    assigneeEmail: event.target.value,
                  }))
                }
                placeholder="owner@example.com"
              />
            </label>

            <div className="form-actions">
              {editingId && (
                <button
                  type="button"
                  className="button ghost"
                  onClick={resetForm}
                  disabled={submitting}
                >
                  Cancel
                </button>
              )}
              <button type="submit" className="button" disabled={submitting}>
                {submitting
                  ? "Saving…"
                  : editingId
                    ? "Update rule"
                    : "Create rule"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
