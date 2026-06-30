export default function KpiLoading() {
  return (
    <div className="space-y-4">
      {/* Titre */}
      <div className="skeleton h-6 w-40 rounded" />
      <div className="skeleton h-4 w-28 rounded opacity-60" />

      {/* Filtres période */}
      <div className="flex gap-2 overflow-hidden">
        {[80, 100, 96].map((w, i) => (
          <div key={i} className="skeleton h-9 flex-shrink-0 rounded-xl" style={{ width: w }} />
        ))}
      </div>

      {/* Bloc parc (fond noir) */}
      <div className="bg-[#1a1a1a] rounded-2xl p-4 space-y-3">
        <div className="skeleton h-3 w-44 rounded opacity-30" style={{ background: 'rgba(255,255,255,0.15)' }} />
        <div className="grid grid-cols-3 gap-y-4 gap-x-2">
          {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
            <div key={i} className="space-y-1.5">
              <div className="h-2 rounded" style={{ width: '60%', background: 'rgba(255,255,255,0.15)', animation: 'shimmer 1.4s ease-in-out infinite', backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0.1) 25%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.1) 75%)', backgroundSize: '200% 100%' }} />
              <div className="h-4 rounded" style={{ width: '80%', background: 'rgba(255,255,255,0.15)', animation: 'shimmer 1.4s ease-in-out infinite', backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0.1) 25%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.1) 75%)', backgroundSize: '200% 100%' }} />
            </div>
          ))}
        </div>
      </div>

      {/* Cards véhicules */}
      {[0, 1, 2, 3].map(i => (
        <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          {/* En-tête véhicule */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="skeleton h-4 w-4 rounded-full flex-shrink-0" />
              <div className="space-y-1">
                <div className="skeleton h-4 w-32 rounded" />
                <div className="skeleton h-3 w-20 rounded opacity-60" />
              </div>
            </div>
            <div className="skeleton h-5 w-16 rounded" />
          </div>

          {/* Grille 9 KPIs */}
          <div className="grid grid-cols-3 gap-y-3 gap-x-2 pb-3 border-b border-gray-50">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(j => (
              <div key={j} className="space-y-1">
                <div className="skeleton h-2 rounded opacity-60" style={{ width: '70%' }} />
                <div className="skeleton h-4 rounded" style={{ width: '85%' }} />
              </div>
            ))}
          </div>

          {/* Coûts par poste */}
          <div className="space-y-2">
            <div className="skeleton h-2 w-24 rounded opacity-50" />
            {[0, 1, 2].map(k => (
              <div key={k} className="flex items-center justify-between">
                <div className="skeleton h-3 rounded" style={{ width: `${40 + k * 10}%` }} />
                <div className="skeleton h-3 w-14 rounded" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
