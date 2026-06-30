// ─── Schéma EDL — zones de détourage partagées (app interactive + PDF contrat) ──
// Repère 1254×1254 du fond reconstruit public/edl/vehicle-blueprint-v3.png.
// Fond v3 + détourage v2 (2026-06-26) : portes/vitres/roues/plaque/bas de caisse
// par extraction de contour (segmentation) ou détection ; ailes retracées au plus
// juste (bord supérieur calé sur le capot détecté + arche calculée depuis la roue
// + couture de porte) ; avant/arrière/dessus retracés sur les lignes réelles.
// Pièces présentes dans 2 vues (pare-brise: dessus+avant ; lunette: dessus+arrière)
// → même id à 2 emplacements. Pneu avant jante (jante cliquable au-dessus).

export const EDL_IMG = 1254
export const EDL_SRC = '/edl/vehicle-blueprint-v3.png'

export type Zone2D = {
  id: string
  label: string
  x?: number; y?: number; w?: number; h?: number; rx?: number
  shape?: 'ellipse'
  points?: [number, number][]
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
  // ── DESSUS ──
  // Capot (vue de dessus, à gauche du pare-brise — avant du véhicule)
  { id: 'capot', label: 'Capot', points: [
    [505,100], [448,88], [380,83], [316,94],
    [278,118], [265,148], [264,168], [265,192],
    [280,218], [318,237], [382,247], [450,244], [505,228],
  ]},
  { id: 'pare-brise', label: 'Pare-brise', points: [[505,100],[536,108],[572,104],[572,224],[536,219],[505,228]] },
  { id: 'toit', label: 'Toit', points: [[572,104],[644,101],[716,101],[716,231],[644,232],[572,224]] },
  { id: 'lunette-arriere', label: 'Lunette AR', points: [[716,101],[758,106],[798,118],[798,214],[758,226],[716,231]] },
  // Coffre (vue de dessus, à droite de la lunette — arrière du véhicule)
  { id: 'coffre', label: 'Coffre', points: [
    [795,106], [845,90], [878,108], [884,148],
    [884,186], [878,218], [845,237], [795,228],
  ]},
  // ── FACE AVANT ──
  { id: 'capot', label: 'Capot', points: [[498,413],[365,413],[330,383],[328,376],[333,372],[533,373],[535,376],[533,384],[498,413]] },
  { id: 'pare-brise', label: 'Pare-brise', points: [[368,351],[440,347],[503,351],[510,374],[440,372],[360,374]] },
  { id: 'calandre', label: 'Calandre', points: [[435,451],[372,449],[362,440],[362,431],[370,422],[495,422],[503,431],[503,440],[492,449],[435,451]] },
  { id: 'phare-gauche', label: 'Phare G', points: [[353,433],[298,422],[298,400],[312,397],[354,415],[361,424]] },
  { id: 'phare-droit', label: 'Phare D', points: [[510,433],[503,422],[503,400],[518,397],[558,415],[566,424],[563,433]] },
  { id: 'retroviseur-gauche', label: 'Rétro G', points: [[308,377],[279,373],[277,360],[286,354],[305,352],[310,366],[308,377]] },
  { id: 'retroviseur-droit', label: 'Rétro D', points: [[565,377],[558,377],[554,373],[556,355],[568,352],[583,356],[586,361],[586,372],[565,377]] },
  { id: 'pare-chocs-avant', label: 'Pare-chocs AV', points: [[311,451],[382,448],[478,448],[555,451],[552,476],[544,497],[330,497],[315,476]] },
  { id: 'plaque-avant', label: 'Plaque AV', points: [[398,455],[466,455],[466,476],[398,476]] },
  { id: 'aile-avant-gauche', label: 'Aile AVG', points: [[258,386],[296,386],[296,456],[260,456]] },
  { id: 'aile-avant-droite', label: 'Aile AVD', points: [[566,386],[604,386],[604,456],[566,456]] },
  // ── FACE ARRIÈRE ──
  // Lunette simplifiée : polygone propre 8 points (ex-34 points auto-croisants supprimés)
  { id: 'lunette-arriere', label: 'Lunette AR', points: [
    [714,422], [712,408], [718,376], [728,364],
    [896,364], [906,376], [912,408], [910,422],
  ]},
  // Coffre simplifié : 5 points au lieu de 27
  { id: 'coffre', label: 'Coffre', points: [
    [700,422], [914,422], [930,453], [924,493], [700,493],
  ]},
  { id: 'feu-arriere-gauche', label: 'Feu AR G', points: [[686,403],[722,405],[721,438],[688,437]] },
  { id: 'feu-arriere-droit', label: 'Feu AR D', points: [[902,405],[938,403],[936,437],[903,438]] },
  { id: 'pare-chocs-arriere', label: 'Pare-chocs AR', points: [[694,459],[812,457],[930,459],[926,499],[700,500]] },
  { id: 'plaque-arriere', label: 'Plaque AR', points: [[768,452],[854,452],[854,478],[768,478]] },
  { id: 'aile-arriere-gauche', label: 'Aile ARG', points: [[643,396],[685,396],[685,462],[645,462]] },
  { id: 'aile-arriere-droite', label: 'Aile ARD', points: [[937,396],[978,396],[978,462],[939,462]] },
  // ── PROFIL GAUCHE ──
  { id: 'vitre-avant-gauche', label: 'Vitre AVG', points: [[539,674], [523,674], [522,653], [508,644], [513,636], [532,626], [580,602], [611,594], [658,588], [668,600], [676,601], [662,666], [539,674]] },
  { id: 'vitre-arriere-gauche', label: 'Vitre ARG', points: [[711,664], [700,662], [707,588], [802,590], [828,596], [840,623], [836,658], [711,664]] },
  { id: 'vitre-laterale-gauche', label: 'Custode G', points: [[1013,658], [974,652], [926,607], [934,602], [952,602], [1008,648], [1016,655], [1013,658]] },
  { id: 'porte-avant-gauche', label: 'Porte AVG', points: [[484,822], [466,819], [468,814], [476,814], [464,811], [460,792], [456,717], [465,684], [640,672], [680,673], [674,725], [674,808], [638,811], [673,812], [673,818], [484,822]] },
  { id: 'porte-arriere-gauche', label: 'Porte ARG', points: [[711,818], [680,818], [676,814], [682,811], [676,803], [676,724], [680,672], [684,668], [864,662], [872,678], [866,700], [850,735], [830,754], [816,775], [806,811], [794,816], [711,818]] },
  { id: 'bas-de-caisse-gauche', label: 'Bas caisse G', points: [[624,834], [471,834], [468,830], [790,824], [791,818], [795,822], [808,813], [814,803], [826,769], [832,762], [834,764], [822,789], [817,834], [624,834]] },
  { id: 'aile-avant-gauche', label: 'Aile AVG', points: [
    [462,648], [390,653], [270,698], [220,726],
    [218,790], [305,743], [322,762], [375,778], [445,762], [462,743],
  ]},
  { id: 'aile-arriere-gauche', label: 'Aile ARG', points: [
    [833,655], [950,648], [1020,668], [1030,720],
    [1004,742], [966,743], [940,762], [897,778], [830,762], [828,743],
    [820,780], [833,712],
  ]},
  { id: 'pneu-av-gauche', label: 'Pneu AVG', shape: 'ellipse', x: 305, y: 743, w: 140, h: 140 },
  { id: 'jante-av-gauche', label: 'Jante AVG', shape: 'ellipse', x: 321, y: 759, w: 108, h: 108 },
  { id: 'pneu-ar-gauche', label: 'Pneu ARG', shape: 'ellipse', x: 828, y: 743, w: 138, h: 138 },
  { id: 'jante-ar-gauche', label: 'Jante ARG', shape: 'ellipse', x: 844, y: 759, w: 106, h: 106 },
  // ── PROFIL DROIT ──
  { id: 'vitre-avant-droite', label: 'Vitre AVD', points: [[715,1022], [592,1014], [578,949], [586,948], [596,936], [643,942], [674,950], [722,974], [741,984], [746,992], [732,1001], [731,1022], [715,1022]] },
  { id: 'vitre-arriere-droite', label: 'Vitre ARD', points: [[543,1012], [418,1006], [414,971], [426,944], [452,938], [547,936], [554,1010], [543,1012]] },
  { id: 'vitre-laterale-droite', label: 'Custode D', points: [[241,1006], [238,1003], [246,996], [302,950], [320,950], [328,955], [280,1000], [241,1006]] },
  { id: 'porte-avant-droite', label: 'Porte AVD', points: [[770,1170], [581,1166], [581,1160], [616,1159], [580,1156], [580,1073], [574,1021], [614,1020], [789,1032], [798,1065], [794,1140], [790,1159], [778,1162], [786,1162], [788,1167], [770,1170]] },
  { id: 'porte-arriere-droite', label: 'Porte ARD', points: [[543,1166], [460,1164], [448,1159], [438,1123], [424,1102], [404,1083], [388,1048], [382,1026], [390,1010], [570,1016], [574,1020], [578,1072], [578,1151], [572,1159], [578,1162], [574,1166], [543,1166]] },
  { id: 'bas-de-caisse-droite', label: 'Bas caisse D', points: [[630,1182], [437,1182], [432,1137], [420,1112], [422,1110], [428,1117], [440,1151], [446,1161], [459,1170], [463,1166], [464,1172], [786,1178], [783,1182], [630,1182]] },
  { id: 'aile-avant-droite', label: 'Aile AVD', points: [
    [796,998], [862,992], [940,996], [1002,1020],
    [1038,1058], [1040,1091], [946,1091], [935,1104], [879,1120], [823,1104], [809,1091],
    [796,1060],
  ]},
  { id: 'aile-arriere-droite', label: 'Aile ARD', points: [
    [421,1002], [312,992], [245,1010], [222,1052],
    [220,1091], [288,1091], [305,1108], [357,1122], [426,1108], [426,1091],
    [422,1060],
  ]},
  { id: 'pneu-av-droite', label: 'Pneu AVD', shape: 'ellipse', x: 809, y: 1091, w: 140, h: 140 },
  { id: 'jante-av-droite', label: 'Jante AVD', shape: 'ellipse', x: 825, y: 1107, w: 108, h: 108 },
  { id: 'pneu-ar-droite', label: 'Pneu ARD', shape: 'ellipse', x: 288, y: 1091, w: 138, h: 138 },
  { id: 'jante-ar-droite', label: 'Jante ARD', shape: 'ellipse', x: 304, y: 1107, w: 106, h: 106 },
]
