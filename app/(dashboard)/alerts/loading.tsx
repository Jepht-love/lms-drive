export default function Loading() {
  return (
    <div className="space-y-3 pt-1">
      <div className="skeleton h-6 w-24" />
      {[0, 1, 2, 3].map(i => (
        <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex gap-3">
          <div className="skeleton w-8 h-8 rounded-full flex-shrink-0 mt-0.5" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="skeleton h-4 w-48" />
            <div className="skeleton h-3 w-32" />
          </div>
        </div>
      ))}
    </div>
  )
}
