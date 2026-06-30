export default function DashboardLoading() {
  return (
    <div className="space-y-4 pt-1">
      {/* Titre */}
      <div className="skeleton h-6 w-40" />
      <div className="skeleton h-4 w-28 opacity-60" />

      {/* Carte principale */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
        <div className="skeleton h-5 w-32" />
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-4 w-3/4" />
        <div className="skeleton h-4 w-5/6" />
      </div>

      {/* Cartes secondaires */}
      {[0, 1, 2].map(i => (
        <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="skeleton h-5 w-28" />
            <div className="skeleton h-5 w-16" />
          </div>
          <div className="skeleton h-4 w-full" />
          <div className="skeleton h-4 w-2/3" />
        </div>
      ))}
    </div>
  )
}
