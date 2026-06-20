export default function StatCard({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="brutal-panel p-5">
      <p className="text-xs font-bold uppercase tracking-wide opacity-70">{label}</p>
      <p className={`text-3xl font-extrabold mt-1 ${accent ? "text-accent" : ""}`}>
        {value}
      </p>
    </div>
  );
}
