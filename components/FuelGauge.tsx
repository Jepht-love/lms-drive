interface FuelGaugeProps {
  level: number // 0-8
  onChange?: (level: number) => void
}

export default function FuelGauge({ level, onChange }: FuelGaugeProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-bold text-gray-400">0</span>
      <div className="flex gap-1">
        {Array.from({ length: 8 }).map((_, i) => (
          <button
            key={i}
            type="button"
            disabled={!onChange}
            onClick={() => onChange?.(i + 1)}
            className={`w-6 h-8 rounded-md border transition-colors ${
              i < level
                ? 'bg-[#111111] border-[#111111]'
                : 'bg-white border-gray-200'
            } ${onChange ? 'cursor-pointer active:scale-95' : 'cursor-default'}`}
          />
        ))}
      </div>
      <span className="text-[11px] font-bold text-gray-400">Plein</span>
    </div>
  )
}
