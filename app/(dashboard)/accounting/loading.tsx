export default function AccountingLoading() {
  return (
    <div className="space-y-4">
      {/* Filtres période */}
      <div className="flex gap-2 overflow-hidden">
        {[80, 72, 60, 88, 80, 96, 60].map((w, i) => (
          <div key={i} className="skeleton h-9 flex-shrink-0 rounded-xl" style={{ width: w }} />
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map(i => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 space-y-2">
            <div className="skeleton h-3 w-14 rounded" />
            <div className="skeleton h-5 w-20 rounded" />
          </div>
        ))}
      </div>

      {/* Boutons d'action */}
      <div className="flex gap-2">
        <div className="skeleton h-10 flex-1 rounded-2xl" />
        <div className="skeleton h-10 w-10 rounded-2xl flex-shrink-0" />
        <div className="skeleton h-10 w-10 rounded-2xl flex-shrink-0" />
      </div>

      {/* Filtres type */}
      <div className="flex gap-2">
        {[56, 72, 80].map((w, i) => (
          <div key={i} className="skeleton h-7 rounded-xl" style={{ width: w }} />
        ))}
      </div>

      {/* Liste transactions */}
      <div className="space-y-2">
        {[0, 1, 2, 3, 4, 5].map(i => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 flex items-center justify-between gap-3">
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="skeleton h-4 rounded" style={{ width: `${55 + (i % 3) * 15}%` }} />
              <div className="skeleton h-3 w-24 rounded opacity-60" />
            </div>
            <div className="skeleton h-5 w-16 rounded flex-shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}
