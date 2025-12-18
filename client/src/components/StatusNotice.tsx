import { useEffect, useState } from "react";

type StatusNoticeProps = {
  message: string | null;
  error: string | null;
};

export function StatusNotice({ message, error }: StatusNoticeProps) {
  const [visible, setVisible] = useState(false);
  const text = error || message;
  const toneClass = error ? "notice-error" : "notice-success";

  useEffect(() => {
    if (!message && !error) {
      setVisible(false);
      return;
    }

    setVisible(true);
    const timeout = window.setTimeout(() => setVisible(false), 3000);

    return () => {
      clearTimeout(timeout);
    };
  }, [message, error]);

  if (!text || !visible) return null;

  return <div className={`notice ${toneClass}`}>{text}</div>;
}
