export default function Loading() {
  return (
    <div className="space-y-3 pt-1">
      <div className="skeleton h-6 w-36" />
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="skeleton h-4 w-32" />
            <div className="skeleton h-5 w-20 rounded-full" />
          </div>
          <div className="skeleton h-3 w-24" />
          <div className="skeleton h-3 w-40" />
        </div>
      ))}
    </div>
  )
}
