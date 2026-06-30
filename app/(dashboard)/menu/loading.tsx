export default function Loading() {
  return (
    <div className="space-y-3 pt-1">
      {[0, 1, 2, 3, 4, 5].map(i => (
        <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
          <div className="skeleton w-9 h-9 rounded-xl flex-shrink-0" />
          <div className="skeleton h-4 w-36" />
        </div>
      ))}
    </div>
  )
}
