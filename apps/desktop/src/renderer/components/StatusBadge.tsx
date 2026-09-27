const MAP: Record<string, { className: string; label: string }> = {
  ready: { className: "badge-success", label: "Completed" },
  error: { className: "badge-error", label: "Failed" },
  extracting: { className: "badge-processing", label: "Processing" },
  reconstructing: { className: "badge-processing", label: "Processing" },
  converting: { className: "badge-processing", label: "Processing" },
  queued: { className: "badge-warning", label: "Queued" },
};

export default function StatusBadge({ stage }: { stage: string }) {
  const item = MAP[stage] ?? { className: "badge-warning", label: stage };
  return <span className={`badge ${item.className}`}>{item.label}</span>;
}
