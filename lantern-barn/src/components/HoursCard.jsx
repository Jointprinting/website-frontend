export default function HoursCard({ hours, className = "" }) {
  if (!hours?.length) return null;
  const today = new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(
    new Date()
  );
  return (
    <div className={`rounded-xl2 bg-white p-6 shadow-soft ${className}`}>
      <p className="eyebrow mb-3">Hours</p>
      <ul className="space-y-1.5 text-sm">
        {hours.map((h, i) => {
          const isToday = h.day?.includes(today);
          return (
            <li
              key={i}
              className={`flex justify-between gap-6 ${
                isToday ? "font-semibold text-pine" : "text-ink/70"
              }`}
            >
              <span>{h.day}</span>
              <span>{h.open}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
