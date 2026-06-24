// ─── Schéma EDL — zones de détourage partagées (app interactive + PDF contrat) ──
// Repère 1254×1254 du fond reconstruit public/edl/vehicle-blueprint-v2.png.
// Certaines pièces apparaissent dans 2 vues (pare-brise : dessus+avant ; lunette
// arrière : dessus+arrière) → même id à 2 emplacements : un dommage les surligne
// dans toutes ses vues. Les jantes sont en dernier (cliquables au-dessus des panneaux).

export const EDL_IMG = 1254
export const EDL_SRC = '/edl/vehicle-blueprint-v2.png'

export type Zone2D = {
  id: string
  label: string
  x?: number; y?: number; w?: number; h?: number; rx?: number
  shape?: 'ellipse'
  points?: [number, number][]   // détourage polygonal (prioritaire sur x/y/w/h)
}

/** Boîte englobante d'une zone (rect, ellipse ou polygone). */
export function zoneBox(z: Zone2D): { x: number; y: number; w: number; h: number } {
  if (z.points && z.points.length) {
    const xs = z.points.map(p => p[0]), ys = z.points.map(p => p[1])
    const x = Math.min(...xs), y = Math.min(...ys)
    return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
  }
  return { x: z.x ?? 0, y: z.y ?? 0, w: z.w ?? 0, h: z.h ?? 0 }
}

export const EDL_ZONES: Zone2D[] = [
  // DESSUS
  { id: 'pare-brise', label: 'Pare-brise', points: [[562,80], [610,68], [610,166], [562,154]] },
  { id: 'toit', label: 'Toit', points: [[612,68], [701,68], [701,166], [612,166]] },
  { id: 'lunette-arriere', label: 'Lunette AR', points: [[703,68], [764,80], [763,154], [703,164]] },
  // FACE AVANT
  { id: 'pare-brise', label: 'Pare-brise', points: [[303,252], [467,250], [503,301], [265,301]] },
  { id: 'capot', label: 'Capot', points: [[264,303], [504,303], [505,348], [262,348]] },
  { id: 'calandre', label: 'Calandre', points: [[300,357], [456,356], [463,378], [446,400], [312,400], [291,378]] },
  { id: 'phare-gauche', label: 'Phare G', points: [[244,361], [301,347], [304,373], [249,381]] },
  { id: 'phare-droit', label: 'Phare D', points: [[463,347], [540,361], [536,383], [466,373]] },
  { id: 'retroviseur-gauche', label: 'Rétro G', points: [[238,288], [262,287], [264,309], [240,311]] },
  { id: 'retroviseur-droit', label: 'Rétro D', points: [[506,287], [530,289], [528,311], [504,309]] },
  { id: 'pare-chocs-avant', label: 'Pare-chocs AV', points: [[244,402], [536,402], [533,459], [249,459]] },
  { id: 'plaque-avant', label: 'Plaque', points: [[346,432], [406,432], [406,452], [346,452]] },
  // FACE ARRIÈRE
  { id: 'lunette-arriere', label: 'Lunette AR', points: [[797,265], [938,263], [956,335], [778,337]] },
  { id: 'coffre', label: 'Coffre', points: [[800,339], [920,339], [922,389], [798,390]] },
  { id: 'feu-arriere-gauche', label: 'Feu G', points: [[762,340], [802,342], [800,385], [760,382]] },
  { id: 'feu-arriere-droit', label: 'Feu D', points: [[918,342], [958,340], [956,384], [916,385]] },
  { id: 'plaque-arriere', label: 'Plaque AR', points: [[820,358], [898,358], [898,378], [820,378]] },
  { id: 'pare-chocs-arriere', label: 'Pare-chocs AR', points: [[758,394], [960,394], [958,444], [760,444]] },
  // PROFIL GAUCHE (front à gauche)
  { id: 'vitre-avant-gauche', label: 'Vitre AVG', points: [[540,548], [698,542], [698,596], [522,596]] },
  { id: 'vitre-arriere-gauche', label: 'Vitre ARG', points: [[706,542], [835,540], [835,596], [706,596]] },
  { id: 'vitre-laterale-gauche', label: 'Custode G', points: [[840,543], [884,548], [878,594], [840,594]] },
  { id: 'aile-avant-gauche', label: 'Aile AVG', points: [[342,616], [366,600], [513,600], [513,688], [495,670], [468,650], [442,644], [414,650], [390,670], [372,688], [340,686], [332,648]] },
  { id: 'porte-avant-gauche', label: 'Porte AVG', points: [[513,600], [702,600], [702,736], [513,736]] },
  { id: 'porte-arriere-gauche', label: 'Porte ARG', points: [[702,600], [840,600], [840,736], [702,736]] },
  { id: 'aile-arriere-gauche', label: 'Aile ARG', points: [[840,600], [900,600], [928,618], [935,690], [916,676], [894,668], [870,674], [848,694], [840,698]] },
  { id: 'bas-de-caisse-gauche', label: 'Bas caisse G', points: [[515,724], [838,724], [837,740], [515,740]] },
  // PROFIL DROIT (front à droite)
  { id: 'vitre-avant-droite', label: 'Vitre AVD', points: [[777,855], [619,849], [619,903], [795,903]] },
  { id: 'vitre-arriere-droite', label: 'Vitre ARD', points: [[611,849], [482,847], [482,903], [611,903]] },
  { id: 'vitre-laterale-droite', label: 'Custode D', points: [[477,850], [433,855], [439,901], [477,901]] },
  { id: 'aile-avant-droite', label: 'Aile AVD', points: [[975,923], [951,907], [804,907], [804,995], [822,977], [849,957], [875,951], [903,957], [927,977], [945,995], [977,993], [985,955]] },
  { id: 'porte-avant-droite', label: 'Porte AVD', points: [[804,907], [615,907], [615,1043], [804,1043]] },
  { id: 'porte-arriere-droite', label: 'Porte ARD', points: [[615,907], [477,907], [477,1043], [615,1043]] },
  { id: 'aile-arriere-droite', label: 'Aile ARD', points: [[477,907], [417,907], [389,925], [382,997], [401,983], [423,975], [447,981], [469,1001], [477,1005]] },
  { id: 'bas-de-caisse-droite', label: 'Bas caisse D', points: [[802,1031], [479,1031], [480,1047], [802,1047]] },
  // JANTES (dessinées en dernier)
  { id: 'jante-av-gauche', label: 'Jante Avant Gauche', shape: 'ellipse', x: 393, y: 668, w: 98, h: 98 },
  { id: 'jante-ar-gauche', label: 'Jante Arrière Gauche', shape: 'ellipse', x: 845, y: 668, w: 98, h: 98 },
  { id: 'jante-av-droite', label: 'Jante Avant Droite', shape: 'ellipse', x: 826, y: 975, w: 98, h: 98 },
  { id: 'jante-ar-droite', label: 'Jante Arrière Droite', shape: 'ellipse', x: 374, y: 975, w: 98, h: 98 },
]
