export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center max-w-sm w-full">
        <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">📡</span>
        </div>
        <h1 className="text-lg font-black text-gray-900 mb-2">Pas de connexion</h1>
        <p className="text-[13px] text-gray-400 mb-6 leading-relaxed">
          LMS Drive nécessite une connexion pour se charger. Vérifiez votre réseau et réessayez.
        </p>
        <a href="/"
          className="block w-full py-3 bg-[#111111] text-white rounded-xl font-semibold text-sm text-center">
          Réessayer
        </a>
      </div>
    </div>
  )
}
