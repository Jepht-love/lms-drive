export default function Loading() {
  return (
    <div className="space-y-3 pt-1">
      <div className="skeleton h-6 w-32" />
      {[0, 1, 2, 3, 4, 5].map(i => (
        <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
          <div className="skeleton h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-4 w-40" />
            <div className="skeleton h-3 w-28" />
          </div>
        </div>
      ))}
    </div>
  )
}
