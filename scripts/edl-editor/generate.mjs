// ─── Générateur de l'éditeur de zones EDL (dev-only, autonome) ────────────────
// Produit un unique fichier HTML autonome (edl-editor.local.html à la racine) qui
// embarque : le line-art (public/edl/vehicle-blueprint-v3.png en data URI), les
// polygones ACTUELS lus depuis components/vehicle-schema/edl-zones.ts, et le texte
// source du fichier (pour un export « drop-in »). Aucun serveur, aucune build.
//
//   node scripts/edl-editor/generate.mjs           → génère le fichier
//   node scripts/edl-editor/generate.mjs --open    → génère puis l'ouvre (macOS)
//
// L'éditeur permet de déplacer / insérer / supprimer chaque point à la souris puis
// de réexporter edl-zones.ts au format identique (seules les coordonnées des zones
// modifiées changent). Les cercles jantes/pneus sont en lecture seule.

import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const here = (p) => fileURLToPath(new URL(p, import.meta.url))
const ROOT = here('../../')
const ZONES_TS = ROOT + 'components/vehicle-schema/edl-zones.ts'
const BLUEPRINT = ROOT + 'public/edl/vehicle-blueprint-v3.png'
const TEMPLATE = here('./template.html')
const OUT = ROOT + 'edl-editor.local.html'

const srcText = await readFile(ZONES_TS, 'utf8')

// EDL_IMG
const IMG = Number(/EDL_IMG\s*=\s*(\d+)/.exec(srcText)[1])

// Extraction du tableau EDL_ZONES par équilibrage de crochets, puis eval (JS pur :
// objets {id,label,points/shape…}, commentaires et virgules finales tolérés).
const bOpen = srcText.indexOf('[', srcText.indexOf('=', srcText.indexOf('EDL_ZONES')))
let depth = 0, i = bOpen
for (; i < srcText.length; i++) { if (srcText[i] === '[') depth++; else if (srcText[i] === ']') { depth--; if (depth === 0) { i++; break } } }
const zones = new Function('return ' + srcText.slice(bOpen, i))()

// Line-art en data URI
const png = await readFile(BLUEPRINT)
const dataUri = 'data:image/png;base64,' + png.toString('base64')

// Presets de vue (éditeur seulement) + zones signalées imprécises
const PRIORITY = ['aile-avant-gauche', 'capot', 'aile-arriere-droite', 'aile-avant-droite']
const VIEWS = [
  { key: 'all', label: 'Tout', ids: null },
  { key: 'dessus', label: 'Dessus', ids: ['capot', 'pare-brise', 'toit'] },
  { key: 'avant', label: 'Face avant', ids: ['calandre', 'phare-gauche', 'phare-droit', 'retroviseur-gauche', 'retroviseur-droit', 'pare-chocs-avant', 'plaque-avant'] },
  { key: 'arriere', label: 'Face arrière', ids: ['lunette-arriere', 'coffre', 'feu-arriere-gauche', 'feu-arriere-droit', 'pare-chocs-arriere', 'plaque-arriere'] },
  { key: 'profil-g', label: 'Profil gauche', ids: ['vitre-avant-gauche', 'vitre-arriere-gauche', 'vitre-laterale-gauche', 'porte-avant-gauche', 'porte-arriere-gauche', 'bas-de-caisse-gauche', 'aile-avant-gauche', 'aile-arriere-gauche', 'pneu-av-gauche', 'jante-av-gauche', 'pneu-ar-gauche', 'jante-ar-gauche'] },
  { key: 'profil-d', label: 'Profil droit', ids: ['vitre-avant-droite', 'vitre-arriere-droite', 'vitre-laterale-droite', 'porte-avant-droite', 'porte-arriere-droite', 'bas-de-caisse-droite', 'aile-avant-droite', 'aile-arriere-droite', 'pneu-av-droite', 'jante-av-droite', 'pneu-ar-droite', 'jante-ar-droite'] },
]

let html = await readFile(TEMPLATE, 'utf8')
const put = (tok, val) => { html = html.split(tok).join(val) }
put('__IMG__', String(IMG))
put('"__SRC_DATA_URI__"', JSON.stringify(dataUri))
put('__ZONES_JSON__', JSON.stringify(zones))
put('__SRCTEXT_JSON__', JSON.stringify(srcText))
put('__PRIORITY_JSON__', JSON.stringify(PRIORITY))
put('__VIEWS_JSON__', JSON.stringify(VIEWS))

if (/__[A-Z_]+__/.test(html)) { console.error('⚠️ Token non remplacé dans le gabarit — abandon.'); process.exit(1) }

await writeFile(OUT, html)

const polys = zones.filter(z => z.points).length
console.log(`✅ Généré : ${OUT}`)
console.log(`   ${zones.length} zones (${polys} polygones éditables, ${zones.length - polys} ellipses verrouillées) · repère ${IMG} · ${(html.length / 1024).toFixed(0)} Ko`)

if (process.argv.includes('--open') && process.platform === 'darwin') {
  spawn('open', [OUT], { stdio: 'ignore', detached: true }).unref()
  console.log('   → ouverture dans le navigateur par défaut…')
}
