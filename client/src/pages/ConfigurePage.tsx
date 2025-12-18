import { FormEvent, useEffect, useMemo, useState } from "react";
import { createRule, deleteRule, fetchRules, updateRule } from "../api";
import { Rule, RulePayload } from "../types";
import { RuleModal } from "../components/RuleModal";
import { RulesTableCard } from "../components/RulesTableCard";
import { ConfigureHeader } from "../components/ConfigureHeader";
import { StatusNotice } from "../components/StatusNotice";
import { createInitialRule } from "../constants/rules";
import "../styles/configure.css";

export default function ConfigurePage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [formState, setFormState] = useState<RulePayload>(createInitialRule());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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
  };

  const closeModal = () => {
    resetForm();
    setIsModalOpen(false);
    setError(null);
  };

  const startCreate = () => {
    resetForm();
    setMessage(null);
    setError(null);
    setIsModalOpen(true);
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
    setIsModalOpen(true);
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
      resetForm();
      setIsModalOpen(false);
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
        closeModal();
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

  return (
    <div className="configure-page">
      <StatusNotice message={message} error={error} />

      <ConfigureHeader onCreate={startCreate} />

      <div className="configure-flex">
        <RulesTableCard
          rules={sortedRules}
          totalCount={rules.length}
          loading={loading}
          submitting={submitting}
          onEdit={startEdit}
          onDelete={handleDelete}
        />
      </div>

      <RuleModal
        isOpen={isModalOpen}
        editingId={editingId}
        formState={formState}
        onChange={setFormState}
        onSubmit={handleSubmit}
        onClose={closeModal}
        submitting={submitting}
      />
    </div>
  );
}
