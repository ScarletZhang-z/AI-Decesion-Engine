type StatusNoticeProps = {
  message: string | null;
  error: string | null;
};

export function StatusNotice({ message, error }: StatusNoticeProps) {
  if (!message && !error) return null;
  const text = error || message;
  const toneClass = error ? "notice-error" : "notice-success";

  return <div className={`notice ${toneClass}`}>{text}</div>;
}
