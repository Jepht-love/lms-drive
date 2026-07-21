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
  { id: 'capot', label: 'Capot', points: [[457,91], [458,44], [396,44], [377,51], [363,62], [348,88], [338,110], [333,142], [332,183], [341,229], [359,263], [385,286], [421,289], [456,293]]},
  { id: 'pare-brise', label: 'Pare-brise', points: [[491,44], [551,70], [595,81], [601,254], [550,261], [484,265]] },
  { id: 'toit', label: 'Toit', points: [[597,85], [701,90], [828,83], [830,246], [669,246], [602,253]] },
  // Lunette AR & Coffre : zones cliquables sur la vue arrière uniquement
  // (pièce unique — pas de doublon d'id sur la vue de dessus).
  // ── FACE AVANT ──
  // Capot & Pare-brise : zones cliquables sur la vue de dessus uniquement
  // (pièce unique — pas de doublon d'id sur la face avant).
  { id: 'calandre', label: 'Calandre', points: [[435,451],[372,449],[362,440],[362,431],[370,422],[495,422],[503,431],[503,440],[492,449],[435,451]] },
  { id: 'phare-gauche', label: 'Phare gauche', points: [[353,433], [348,435], [341,434], [333,434], [326,434], [321,434], [315,434], [309,433], [304,431], [300,427], [298,422], [298,400], [312,397], [354,415], [361,424]] },
  { id: 'phare-droit', label: 'Phare droit', points: [[510,433], [503,422], [516,414], [542,402], [555,399], [563,401], [568,406], [567,416], [566,424], [561,431], [555,434], [537,434]] },
  { id: 'retroviseur-gauche', label: 'Rétroviseur gauche', points: [[308,377],[279,373],[277,360],[286,354],[305,352],[310,366],[308,377]] },
  { id: 'retroviseur-droit', label: 'Rétroviseur droit', points: [[565,377],[558,377],[554,373],[556,355],[568,352],[583,356],[586,361],[586,372],[565,377]] },
  { id: 'pare-chocs-avant', label: 'Pare-chocs avant', points: [[290,448], [290,433], [308,433], [337,435], [353,438], [364,447], [382,448], [478,448], [523,438], [576,428], [576,451], [575,473], [567,502], [526,508], [471,508], [437,508], [406,507], [367,507], [332,505], [297,502], [292,483]] },
  { id: 'plaque-avant', label: 'Plaque avant', points: [[398,455],[466,455],[466,476],[398,476]] },
  // Ailes AVG/AVD : cliquables sur le profil G/D uniquement (pièce unique).
  // ── FACE ARRIÈRE ──
  // Lunette simplifiée : polygone propre 8 points (ex-34 points auto-croisants supprimés)
  { id: 'lunette-arriere', label: 'Lunette arrière', points: [[723,417], [712,408], [722,378], [732,368], [747,363], [768,362], [810,361], [854,362], [891,366], [903,376], [914,412], [902,418], [885,422], [863,425], [829,426], [792,425], [756,423]]},
  // Coffre simplifié : 5 points au lieu de 27
  { id: 'coffre', label: 'Coffre', points: [[731,493], [768,495], [805,498], [832,499], [861,499], [899,488], [909,455], [886,453], [877,440], [931,425], [926,409], [876,425], [852,428], [856,480], [811,481], [773,482], [772,450], [854,449], [853,426], [805,426], [751,424], [728,421], [711,413], [703,426], [740,435], [748,443], [739,453], [716,454]]},
  { id: 'feu-arriere-gauche', label: 'Feu arrière gauche', points: [[688,450], [685,443], [686,435], [689,429], [696,427], [702,427], [709,429], [715,431], [722,432], [729,433], [736,435], [745,442], [745,445], [740,450], [728,452], [717,453], [694,453]] },
  { id: 'feu-arriere-droit', label: 'Feu arrière droit', points: [[880,442], [883,437], [891,435], [904,432], [914,430], [924,428], [932,428], [937,431], [941,439], [942,446], [939,453], [920,454], [900,452], [889,452], [884,448]] },
  { id: 'pare-chocs-arriere', label: 'Pare-chocs arrière', points: [[677,457], [712,456], [730,498], [773,500], [835,500], [875,499], [902,495], [913,456], [949,455], [946,534], [807,534], [681,537]] },
  { id: 'plaque-arriere', label: 'Plaque arrière', points: [[776,454], [851,454], [852,475], [776,474]] },
  // Ailes ARG/ARD : cliquables sur le profil G/D uniquement (pièce unique).
  // ── PROFIL GAUCHE ──
  { id: 'vitre-avant-gauche', label: 'Vitre avant gauche', points: [[539,674], [523,674], [522,653], [508,644], [513,636], [532,626], [580,602], [611,594], [658,588], [672,587], [678,587], [678,590], [677,594], [676,601], [662,666], [539,674]] },
  { id: 'vitre-arriere-gauche', label: 'Vitre arrière gauche', points: [[711,664], [700,662], [707,588], [802,590], [828,596], [840,623], [836,658], [711,664]] },
  // Vitre latérale = surface vitrée triangulaire fixe derrière la vitre de
  // porte arrière ; ne descend pas sous la ligne de caisse, n'empiète pas sur l'aile.
  { id: 'vitre-laterale-gauche', label: 'Vitre arrière latérale gauche', points: [[836,590], [846,590], [853,591], [859,592], [865,594], [871,599], [881,609], [890,617], [898,625], [900,630], [896,638], [885,648], [874,656], [865,658], [859,644], [854,630], [845,610]] },
  { id: 'porte-avant-gauche', label: 'Porte avant gauche', points: [[484,822], [468,823], [465,815], [463,808], [462,801], [461,793], [461,784], [459,769], [456,717], [465,684], [640,672], [680,673], [674,725], [674,808], [638,811], [673,812], [673,818], [484,822]] },
  { id: 'porte-arriere-gauche', label: 'Porte arrière gauche', points: [[711,818], [680,818], [676,814], [682,811], [676,803], [676,724], [680,672], [684,668], [864,662], [872,678], [866,700], [850,735], [830,754], [816,775], [806,811], [794,816], [711,818]] },
  { id: 'bas-de-caisse-gauche', label: 'Bas de caisse gauche', points: [[624,834], [471,834], [468,830], [790,824], [791,818], [795,822], [808,813], [814,803], [826,769], [832,762], [834,764], [822,789], [817,834], [624,834]] },
  // Aile AVG : détourage validé par le gérant (trace manuelle), calé sur l'arche
  // de roue avant + coutures. Reste hors du pneu (centre 375,813 r70).
  { id: 'aile-avant-gauche', label: 'Aile avant gauche', points: [[460,666], [457,664], [455,661], [453,660], [447,664], [440,667], [435,668], [430,668], [424,670], [417,671], [409,671], [400,671], [384,673], [367,675], [353,677], [334,680], [316,684], [288,692], [276,696], [265,700], [255,705], [245,711], [237,716], [229,721], [227,725], [222,731], [219,735], [217,739], [217,747], [220,753], [219,759], [211,766], [212,790], [218,815], [213,820], [211,823], [213,826], [216,829], [221,830], [226,831], [230,832], [234,833], [238,836], [250,837], [260,837], [269,838], [279,839], [289,840], [300,839], [299,818], [299,802], [303,786], [308,773], [313,765], [319,758], [329,750], [337,744], [347,740], [357,737], [366,735], [374,735], [382,735], [393,737], [403,741], [414,748], [422,753], [428,759], [434,764], [438,770], [444,780], [450,795], [451,809], [452,836], [459,836], [466,837], [466,825], [458,790], [455,761], [453,743], [453,725], [462,688], [463,685], [454,685], [447,685], [444,682], [445,678], [449,674], [458,667]]},
  // Aile ARG : détourage validé par le gérant (trace manuelle), calé sur l'arche
  // de roue arrière + coutures porte/custode. Reste hors du pneu (centre 897,812 r69).
  { id: 'aile-arriere-gauche', label: 'Aile arrière gauche', points: [[895,736], [913,739], [928,745], [939,750], [948,758], [956,766], [961,774], [965,783], [970,795], [972,807], [973,828], [985,826], [1002,824], [1045,815], [1050,806], [1053,803], [1052,797], [1052,774], [1052,739], [1047,736], [1044,733], [1041,729], [1041,720], [1037,712], [1037,697], [1031,702], [1024,705], [1017,708], [1009,708], [1003,708], [998,708], [992,706], [987,703], [980,698], [974,693], [968,688], [963,684], [960,679], [961,675], [964,673], [969,671], [977,669], [983,669], [990,669], [980,658], [974,654], [964,646], [955,637], [940,623], [929,613], [923,606], [914,596], [909,585], [901,584], [893,582], [872,597], [879,603], [883,607], [887,611], [892,616], [898,622], [901,628], [901,633], [900,637], [897,641], [894,644], [890,647], [886,651], [881,655], [875,659], [868,662], [871,669], [875,680], [874,689], [861,721], [857,735], [861,746], [877,739]]},
  { id: 'pneu-av-gauche', label: 'Pneu avant gauche', shape: 'ellipse', x: 305, y: 743, w: 140, h: 140 },
  { id: 'jante-av-gauche', label: 'Jante avant gauche', shape: 'ellipse', x: 321, y: 759, w: 108, h: 108 },
  { id: 'pneu-ar-gauche', label: 'Pneu arrière gauche', shape: 'ellipse', x: 828, y: 743, w: 138, h: 138 },
  { id: 'jante-ar-gauche', label: 'Jante arrière gauche', shape: 'ellipse', x: 844, y: 759, w: 106, h: 106 },
  // ── PROFIL DROIT ──
  { id: 'vitre-avant-droite', label: 'Vitre avant droite', points: [[715,1022], [569,1015], [567,997], [564,968], [560,933], [596,936], [643,942], [674,950], [722,974], [741,984], [746,992], [732,1001], [731,1022], [715,1022]] },
  { id: 'vitre-arriere-droite', label: 'Vitre arrière droite', points: [[543,1012], [418,1006], [414,971], [426,944], [452,938], [547,936], [554,1010], [543,1012]] },
  // Vitre latérale D : même règle que côté gauche (surface vitrée seule), miroir côté droit.
  { id: 'vitre-laterale-droite', label: 'Vitre arrière latérale droite', points: [[417,939], [408,940], [396,943], [387,946], [379,953], [372,960], [365,967], [358,974], [352,982], [355,988], [368,999], [380,1008], [386,1010], [390,1003], [399,979], [405,966], [411,954]] },
  { id: 'porte-avant-droite', label: 'Porte avant droite', points: [[770,1170], [577,1167], [577,1162], [577,1156], [577,1148], [576,1071], [574,1021], [614,1023], [789,1032], [798,1065], [792,1141], [790,1159], [789,1164], [788,1169], [781,1169], [770,1170]] },
  { id: 'porte-arriere-droite', label: 'Porte arrière droite', points: [[543,1166], [460,1164], [448,1159], [429,1120], [417,1104], [409,1095], [403,1093], [400,1088], [392,1070], [388,1060], [384,1050], [381,1040], [379,1036], [379,1032], [379,1028], [381,1023], [382,1019], [384,1015], [389,1015], [460,1018], [564,1021], [572,1075], [573,1118], [574,1146], [573,1160], [573,1167], [560,1167], [543,1166]] },
  { id: 'bas-de-caisse-droite', label: 'Bas de caisse droite', points: [[626,1191], [569,1191], [504,1192], [431,1193], [430,1181], [430,1170], [431,1163], [442,1163], [448,1170], [458,1172], [469,1173], [486,1173], [520,1173], [763,1177], [801,1172], [801,1191], [711,1192], [658,1192]] },
  // Aile AVD : détourage validé par le gérant (trace manuelle, miroir de l'AVG),
  // calé sur l'arche avant droite. Reste hors du pneu (centre 879,1161 r70).
  { id: 'aile-avant-droite', label: 'Aile avant droite', points: [[1001,1192], [972,1194], [953,1194], [953,1189], [954,1180], [954,1173], [954,1164], [953,1152], [950,1142], [948,1133], [941,1122], [935,1114], [930,1108], [924,1103], [917,1099], [909,1095], [900,1091], [891,1089], [883,1088], [875,1088], [868,1089], [858,1091], [846,1094], [832,1103], [822,1112], [813,1123], [805,1140], [801,1168], [793,1169], [798,1106], [799,1055], [793,1037], [806,1037], [807,1028], [795,1019], [802,1013], [810,1015], [824,1020], [847,1023], [868,1026], [891,1030], [915,1033], [946,1038], [987,1053], [1022,1075], [1028,1080], [1032,1083], [1035,1086], [1037,1088], [1038,1091], [1038,1095], [1038,1099], [1038,1102], [1037,1104], [1035,1106], [1034,1110], [1039,1114], [1042,1119], [1042,1132], [1041,1184]]},
  // Aile ARD : détourage validé par le gérant (trace manuelle, miroir de l'ARG),
  // calé sur l'arche arrière droite + coutures. Reste hors du pneu (centre 357,1160 r69).
  { id: 'aile-arriere-droite', label: 'Aile arrière droite', points: [[332,1092], [312,1101], [298,1111], [283,1131], [277,1147], [277,1181], [266,1179], [259,1177], [251,1176], [243,1173], [236,1172], [227,1170], [222,1168], [218,1162], [215,1156], [212,1149], [211,1143], [214,1137], [215,1131], [213,1122], [213,1096], [235,1078], [239,1058], [263,1060], [293,1038], [297,1029], [287,1024], [274,1022], [282,1011], [307,989], [333,963], [345,949], [353,935], [362,934], [373,933], [384,932], [388,944], [383,948], [356,974], [351,983], [352,988], [367,1002], [381,1015], [374,1027], [377,1045], [397,1086], [400,1105], [378,1095], [361,1089], [346,1088]]},
  { id: 'pneu-av-droite', label: 'Pneu avant droite', shape: 'ellipse', x: 809, y: 1091, w: 140, h: 140 },
  { id: 'jante-av-droite', label: 'Jante avant droite', shape: 'ellipse', x: 825, y: 1107, w: 108, h: 108 },
  { id: 'pneu-ar-droite', label: 'Pneu arrière droite', shape: 'ellipse', x: 288, y: 1091, w: 138, h: 138 },
  { id: 'jante-ar-droite', label: 'Jante arrière droite', shape: 'ellipse', x: 304, y: 1107, w: 106, h: 106 },
]
