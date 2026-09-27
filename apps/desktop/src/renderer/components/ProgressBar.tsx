export default function ProgressBar({
  percent,
  label,
  eta,
}: {
  percent: number;
  label: string;
  eta?: string;
}) {
  return (
    <div className="progress">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <strong>{label}</strong>
        <span className="muted">{Math.round(percent)}%{eta ? ` · ${eta}` : ""}</span>
      </div>
      <div className="track" role="progressbar" aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100}>
        <div className="fill" style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
      </div>
    </div>
  );
}
