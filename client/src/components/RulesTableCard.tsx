import { formatCondition } from "../constants/rules";
import { Rule } from "../types";

type RulesTableCardProps = {
  rules: Rule[];
  totalCount: number;
  loading: boolean;
  submitting: boolean;
  onEdit: (rule: Rule) => void;
  onDelete: (rule: Rule) => void;
};

export function RulesTableCard({
  rules,
  totalCount,
  loading,
  submitting,
  onEdit,
  onDelete,
}: RulesTableCardProps) {
  return (
    <section className="card">
      <header className="card-header">
        <div>
          <h2>Existing Rules</h2>
          <p>Click edit to modify or remove a rule.</p>
        </div>
        <span className="badge">{totalCount} total</span>
      </header>

      {loading ? (
        <p className="muted">Loading rules…</p>
      ) : rules.length === 0 ? (
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
              {rules.map((rule) => (
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
                      onClick={() => onEdit(rule)}
                      disabled={submitting}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="button danger"
                      onClick={() => onDelete(rule)}
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
  );
}
