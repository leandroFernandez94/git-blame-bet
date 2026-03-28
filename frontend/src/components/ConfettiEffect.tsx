import { useEffect, useState } from "react";

export function ConfettiEffect() {
  const [particles, setParticles] = useState<
    { id: number; x: number; delay: number; color: string }[]
  >([]);

  useEffect(() => {
    const colors = [
      "#22c55e",
      "#3b82f6",
      "#eab308",
      "#ec4899",
      "#8b5cf6",
      "#f97316",
    ];
    const items = Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 0.5,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));
    setParticles(items);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute h-2 w-2 rounded-full"
          style={{
            left: `${p.x}%`,
            top: "-10px",
            backgroundColor: p.color,
            animation: `confetti-fall 1.5s ease-in ${p.delay}s forwards`,
          }}
        />
      ))}
      <style>{`
        @keyframes confetti-fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
