/**
 * Séparateur de milliers pour tout ce qui part dans un PDF.
 *
 * `toLocaleString('fr-FR')` sépare les milliers avec U+202F, une espace fine
 * insécable. Les polices Helvetica embarquées dans les PDF ne connaissent pas
 * ce caractère et impriment un glyphe parasite à sa place : « 15 000 € » sort
 * imprimé « 15/000 € », et « 23 980 km » sort « 23/980 km ».
 *
 * On utilise donc une espace ASCII normale, que toutes les polices savent
 * rendre. Règle : dans un modèle de PDF, jamais de `toLocaleString`.
 */
export function fmtEntier(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

/**
 * Idem, mais garde les centimes quand il y en a — les prix unitaires et les
 * totaux de facture ne sont pas toujours ronds. Un montant entier reste écrit
 * sans virgule, comme avant, pour ne rien changer aux factures déjà émises.
 */
export function fmtNombre(n: number): string {
  const { signe, entier, centimes } = decoupe(n)
  return centimes === 0
    ? `${signe}${fmtEntier(entier)}`
    : `${signe}${fmtEntier(entier)},${String(centimes).padStart(2, '0')}`
}

/**
 * Montant en euros, toujours avec les centimes : « 10 000,00 € ».
 *
 * Remplace `Intl.NumberFormat` en style monnaie, qui produisait deux caractères
 * invisibles illisibles par la police du PDF — celui des milliers et celui qui
 * précède le symbole €.
 */
export function fmtEuro(n: number): string {
  const { signe, entier, centimes } = decoupe(n)
  return `${signe}${fmtEntier(entier)},${String(centimes).padStart(2, '0')} €`
}

function decoupe(n: number) {
  const arrondi = Math.round(n * 100) / 100
  const abs = Math.abs(arrondi)
  const entier = Math.trunc(abs)
  return {
    signe: arrondi < 0 ? '-' : '',
    entier,
    centimes: Math.round((abs - entier) * 100),
  }
}
