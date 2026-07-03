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
  // Lunette AR & Coffre : zones cliquables sur la vue arrière uniquement
  // (pièce unique — pas de doublon d'id sur la vue de dessus).
  // ── FACE AVANT ──
  // Capot & Pare-brise : zones cliquables sur la vue de dessus uniquement
  // (pièce unique — pas de doublon d'id sur la face avant).
  { id: 'calandre', label: 'Calandre', points: [[435,451],[372,449],[362,440],[362,431],[370,422],[495,422],[503,431],[503,440],[492,449],[435,451]] },
  { id: 'phare-gauche', label: 'Phare gauche', points: [[353,433],[298,422],[298,400],[312,397],[354,415],[361,424]] },
  { id: 'phare-droit', label: 'Phare droit', points: [[510,433],[503,422],[503,400],[518,397],[558,415],[566,424],[563,433]] },
  { id: 'retroviseur-gauche', label: 'Rétroviseur gauche', points: [[308,377],[279,373],[277,360],[286,354],[305,352],[310,366],[308,377]] },
  { id: 'retroviseur-droit', label: 'Rétroviseur droit', points: [[565,377],[558,377],[554,373],[556,355],[568,352],[583,356],[586,361],[586,372],[565,377]] },
  { id: 'pare-chocs-avant', label: 'Pare-chocs avant', points: [[311,451],[382,448],[478,448],[555,451],[552,476],[544,497],[330,497],[315,476]] },
  { id: 'plaque-avant', label: 'Plaque avant', points: [[398,455],[466,455],[466,476],[398,476]] },
  // Ailes AVG/AVD : cliquables sur le profil G/D uniquement (pièce unique).
  // ── FACE ARRIÈRE ──
  // Lunette simplifiée : polygone propre 8 points (ex-34 points auto-croisants supprimés)
  { id: 'lunette-arriere', label: 'Lunette arrière', points: [
    [714,422], [712,408], [718,376], [728,364],
    [896,364], [906,376], [912,408], [910,422],
  ]},
  // Coffre simplifié : 5 points au lieu de 27
  { id: 'coffre', label: 'Coffre', points: [
    [700,422], [914,422], [930,453], [924,493], [700,493],
  ]},
  { id: 'feu-arriere-gauche', label: 'Feu arrière gauche', points: [[686,403],[722,405],[721,438],[688,437]] },
  { id: 'feu-arriere-droit', label: 'Feu arrière droit', points: [[902,405],[938,403],[936,437],[903,438]] },
  { id: 'pare-chocs-arriere', label: 'Pare-chocs arrière', points: [[694,459],[812,457],[930,459],[926,499],[700,500]] },
  { id: 'plaque-arriere', label: 'Plaque arrière', points: [[768,452],[854,452],[854,478],[768,478]] },
  // Ailes ARG/ARD : cliquables sur le profil G/D uniquement (pièce unique).
  // ── PROFIL GAUCHE ──
  { id: 'vitre-avant-gauche', label: 'Vitre avant gauche', points: [[539,674], [523,674], [522,653], [508,644], [513,636], [532,626], [580,602], [611,594], [658,588], [668,600], [676,601], [662,666], [539,674]] },
  { id: 'vitre-arriere-gauche', label: 'Vitre arrière gauche', points: [[711,664], [700,662], [707,588], [802,590], [828,596], [840,623], [836,658], [711,664]] },
  // Vitre latérale = surface vitrée triangulaire fixe derrière la vitre de
  // porte arrière ; ne descend pas sous la ligne de caisse, n'empiète pas sur l'aile.
  { id: 'vitre-laterale-gauche', label: 'Vitre arrière latérale gauche', points: [[845,594], [871,600], [890,617], [897,632], [884,647], [858,657]] },
  { id: 'porte-avant-gauche', label: 'Porte avant gauche', points: [[484,822], [466,819], [468,814], [476,814], [464,811], [460,792], [456,717], [465,684], [640,672], [680,673], [674,725], [674,808], [638,811], [673,812], [673,818], [484,822]] },
  { id: 'porte-arriere-gauche', label: 'Porte arrière gauche', points: [[711,818], [680,818], [676,814], [682,811], [676,803], [676,724], [680,672], [684,668], [864,662], [872,678], [866,700], [850,735], [830,754], [816,775], [806,811], [794,816], [711,818]] },
  { id: 'bas-de-caisse-gauche', label: 'Bas de caisse gauche', points: [[624,834], [471,834], [468,830], [790,824], [791,818], [795,822], [808,813], [814,803], [826,769], [832,762], [834,764], [822,789], [817,834], [624,834]] },
  // Aile AVG : détourage validé par le gérant (trace manuelle), calé sur l'arche
  // de roue avant + coutures. Reste hors du pneu (centre 375,813 r70).
  { id: 'aile-avant-gauche', label: 'Aile avant gauche', points: [
    [466,652], [453,644], [394,657], [292,682], [215,720], [211,760], [208,786],
    [298,743], [320,762], [378,739], [435,768], [458,759], [457,714], [462,678],
  ]},
  // Aile ARG : détourage validé par le gérant (trace manuelle), calé sur l'arche
  // de roue arrière + coutures porte/custode. Reste hors du pneu (centre 897,812 r69).
  { id: 'aile-arriere-gauche', label: 'Aile arrière gauche', points: [
    [904,737], [948,746], [977,774], [986,827], [1045,815], [1053,788], [1054,748],
    [1040,735], [1037,712], [1036,677], [976,657], [940,623], [900,632], [862,664],
    [872,689], [854,737], [864,746],
  ]},
  { id: 'pneu-av-gauche', label: 'Pneu avant gauche', shape: 'ellipse', x: 305, y: 743, w: 140, h: 140 },
  { id: 'jante-av-gauche', label: 'Jante avant gauche', shape: 'ellipse', x: 321, y: 759, w: 108, h: 108 },
  { id: 'pneu-ar-gauche', label: 'Pneu arrière gauche', shape: 'ellipse', x: 828, y: 743, w: 138, h: 138 },
  { id: 'jante-ar-gauche', label: 'Jante arrière gauche', shape: 'ellipse', x: 844, y: 759, w: 106, h: 106 },
  // ── PROFIL DROIT ──
  { id: 'vitre-avant-droite', label: 'Vitre avant droite', points: [[715,1022], [592,1014], [578,949], [586,948], [596,936], [643,942], [674,950], [722,974], [741,984], [746,992], [732,1001], [731,1022], [715,1022]] },
  { id: 'vitre-arriere-droite', label: 'Vitre arrière droite', points: [[543,1012], [418,1006], [414,971], [426,944], [452,938], [547,936], [554,1010], [543,1012]] },
  // Vitre latérale D : même règle que côté gauche (surface vitrée seule), miroir côté droit.
  { id: 'vitre-laterale-droite', label: 'Vitre arrière latérale droite', points: [[412,942], [383,947], [361,964], [352,982], [366,998], [392,1007]] },
  { id: 'porte-avant-droite', label: 'Porte avant droite', points: [[770,1170], [581,1166], [581,1160], [616,1159], [580,1156], [580,1073], [574,1021], [614,1020], [789,1032], [798,1065], [794,1140], [790,1159], [778,1162], [786,1162], [788,1167], [770,1170]] },
  { id: 'porte-arriere-droite', label: 'Porte arrière droite', points: [[543,1166], [460,1164], [448,1159], [438,1123], [424,1102], [404,1083], [388,1048], [382,1026], [390,1010], [570,1016], [574,1020], [578,1072], [578,1151], [572,1159], [578,1162], [574,1166], [543,1166]] },
  { id: 'bas-de-caisse-droite', label: 'Bas de caisse droite', points: [[630,1182], [437,1182], [432,1137], [420,1112], [422,1110], [428,1117], [440,1151], [446,1161], [459,1170], [463,1166], [464,1172], [786,1178], [783,1182], [630,1182]] },
  // Aile AVD : détourage validé par le gérant (trace manuelle, miroir de l'AVG),
  // calé sur l'arche avant droite. Reste hors du pneu (centre 879,1161 r70).
  { id: 'aile-avant-droite', label: 'Aile avant droite', points: [
    [929,1105], [882,1085], [825,1109], [800,1098], [801,1057], [794,1018], [788,988],
    [798,977], [835,993], [886,1002], [991,1033], [1036,1057], [1041,1105], [1042,1132], [952,1087],
  ]},
  // Aile ARD : détourage validé par le gérant (trace manuelle, miroir de l'ARG),
  // calé sur l'arche arrière droite + coutures. Reste hors du pneu (centre 357,1160 r69).
  { id: 'aile-arriere-droite', label: 'Aile arrière droite', points: [
    [362,1087], [294,1126], [284,1179], [226,1168], [219,1141], [219,1096], [233,1082],
    [236,1053], [236,1021], [304,998], [355,949], [388,958], [404,1014], [394,1038],
    [419,1091], [410,1103],
  ]},
  { id: 'pneu-av-droite', label: 'Pneu avant droite', shape: 'ellipse', x: 809, y: 1091, w: 140, h: 140 },
  { id: 'jante-av-droite', label: 'Jante avant droite', shape: 'ellipse', x: 825, y: 1107, w: 108, h: 108 },
  { id: 'pneu-ar-droite', label: 'Pneu arrière droite', shape: 'ellipse', x: 288, y: 1091, w: 138, h: 138 },
  { id: 'jante-ar-droite', label: 'Jante arrière droite', shape: 'ellipse', x: 304, y: 1107, w: 106, h: 106 },
]
