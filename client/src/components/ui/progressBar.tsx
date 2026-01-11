interface ProgressBarProps {
  value: number;
}

export function ProgressBar({ value }: ProgressBarProps) {
  const clampedValue = Math.min(100, Math.max(0, value));

  return (
    <div
      className="progressBar"
      role="progressbar"
      aria-valuenow={clampedValue}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={`${clampedValue}%`}
    >
      <div className="progressBarFill" style={{ width: `${clampedValue}%` }} />
    </div>
  );
}
