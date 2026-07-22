export default function Loading() {
  return (
    <div className="space-y-3 pt-1">
      <div className="skeleton h-6 w-40" />
      <div className="skeleton h-10 w-full rounded-xl" />
      {[0, 1, 2, 3].map(i => (
        <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          <div className="skeleton h-4 w-32" />
          <div className="skeleton h-3 w-48" />
          <div className="skeleton h-3 w-24" />
        </div>
      ))}
    </div>
  )
}
