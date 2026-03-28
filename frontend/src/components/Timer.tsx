export function Timer({
  duration,
  remaining,
}: {
  duration: number;
  remaining: number;
}) {
  const seconds = Math.ceil(remaining / 1000);
  const progress = remaining / duration;

  const color =
    progress > 0.5
      ? "text-green-400"
      : progress > 0.25
        ? "text-yellow-400"
        : "text-red-400";

  const strokeColor =
    progress > 0.5
      ? "stroke-green-400"
      : progress > 0.25
        ? "stroke-yellow-400"
        : "stroke-red-400";

  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress);

  return (
    <div className="relative flex h-24 w-24 items-center justify-center">
      <svg className="absolute h-full w-full -rotate-90" viewBox="0 0 80 80">
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          className="text-gray-700"
        />
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={`${strokeColor} transition-all duration-1000 ease-linear`}
        />
      </svg>
      <span className={`text-2xl font-bold ${color}`}>{seconds}</span>
    </div>
  );
}
