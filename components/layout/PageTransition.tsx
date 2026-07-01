// Conteneur de page — sans animation d'entrée (rendu instantané, aspect sobre).
// Conservé comme point d'insertion unique entre le layout et le contenu.
export default function PageTransition({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
