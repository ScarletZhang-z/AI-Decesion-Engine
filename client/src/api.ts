import { Rule, RulePayload } from "./types";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000";

const parseErrorMessage = async (response: Response): Promise<string> => {
  try {
    const data = (await response.json()) as { error?: string };
    if (data?.error) {
      return data.error;
    }
  } catch {
    // Ignore JSON parse errors
  }

  return response.statusText || "Request failed";
};

const handleJson = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const message = await parseErrorMessage(response);
    throw new Error(message);
  }

  return (await response.json()) as T;
};

export const fetchRules = async (): Promise<Rule[]> => {
  const response = await fetch(`${API_BASE_URL}/api/rules`);
  return handleJson<Rule[]>(response);
};

export const createRule = async (payload: RulePayload): Promise<Rule> => {
  const response = await fetch(`${API_BASE_URL}/api/rules`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return handleJson<Rule>(response);
};

export const updateRule = async (
  id: string,
  payload: RulePayload
): Promise<Rule> => {
  const response = await fetch(`${API_BASE_URL}/api/rules/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return handleJson<Rule>(response);
};

export const deleteRule = async (id: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/api/rules/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const message = await parseErrorMessage(response);
    throw new Error(message);
  }
};
