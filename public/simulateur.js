/* Simulateur d'appareil + mode remarque — LMS Drive
   Version du 29/07/2026, extraite telle quelle de la session où elle a été
   construite avec Jeff. Ne pas la réécrire de mémoire : c'est la source.
   Les remarques vivent dans la mémoire du navigateur (clé lms_remarques),
   liées à l'ORIGINE : localhost:3100 n'est pas localhost:3000. */
const garde = localStorage.getItem('lms_remarques') || '[]';
document.documentElement.innerHTML = `<head><title>Simulateur — LMS Drive</title><style>
 *{box-sizing:border-box}
 body{margin:0;background:#1c1c1e;color:#fff;font-family:system-ui;padding:74px 0 24px;min-height:100vh}
 #entete{position:fixed;top:0;left:0;right:0;background:rgba(28,28,30,.96);backdrop-filter:blur(8px);padding:10px 12px 8px;z-index:50;display:flex;flex-direction:column;align-items:center;gap:4px;border-bottom:1px solid #2c2c2e}
 .barre{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;align-items:center}
 button{border:0;border-radius:999px;padding:8px 16px;font-size:13px;font-weight:600;background:#2c2c2e;color:#fff;cursor:pointer}
 button.on{background:#fff;color:#111}
 button.rouge{background:#ff453a;color:#fff}
 .taille{font-size:11px;color:#8e8e93}
 #zone{display:flex;justify-content:center}
 iframe{border:0;border-radius:30px;box-shadow:0 0 0 10px #000,0 20px 60px rgba(0,0,0,.6);background:#fff}
 #panneau{position:fixed;right:16px;top:84px;width:340px;max-height:80vh;overflow:auto;background:#2c2c2e;border-radius:16px;padding:14px;display:none;z-index:60}
 #panneau h3{margin:0 0 10px;font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:#8e8e93}
 .note{background:#1c1c1e;border-radius:10px;padding:10px;margin-bottom:8px;font-size:12px;line-height:1.45}
 .note .ou{color:#0a84ff;font-weight:600;display:block}
 .note .quoi{color:#fff;margin-top:6px;display:block}
 .note .pj{color:#30d158;margin-top:6px;display:block;font-weight:600}
 .note .no{color:#ff9f0a;font-weight:800;display:block;margin-bottom:2px}
 .note .sup{float:right;color:#ff453a;cursor:pointer;font-weight:700}
 #selListe{position:fixed;left:50%;bottom:74px;transform:translateX(-50%);width:min(600px,92vw);max-height:40vh;overflow:auto;background:#2c2c2e;border-radius:14px;padding:10px;display:none;z-index:71;box-shadow:0 12px 40px rgba(0,0,0,.5)}
 .lg{display:flex;align-items:center;gap:8px;padding:7px 8px;border-radius:8px;font-size:12px;line-height:1.4}
 .lg:nth-child(odd){background:#1c1c1e}
 .lg .txt{flex:1;min-width:0}
 .lg .num{color:#8e8e93;font-weight:700;width:22px;flex-shrink:0}
 .lg .x{color:#ff453a;font-weight:700;cursor:pointer;padding:0 6px;flex-shrink:0}
 #selection{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);background:#0a84ff;border-radius:999px;padding:8px 10px 8px 8px;display:none;gap:8px;align-items:center;z-index:70;box-shadow:0 12px 40px rgba(0,0,0,.5)}
 #compte{font-size:13px;font-weight:600;cursor:pointer;padding:6px 12px;border-radius:999px;background:rgba(255,255,255,.18)}
 #selection button{background:rgba(255,255,255,.2);padding:6px 12px}
 #selection button.blanc{background:#fff;color:#0a84ff}
 #saisie{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);width:min(620px,92vw);background:#2c2c2e;border-radius:16px;padding:14px;display:none;z-index:80;box-shadow:0 20px 60px rgba(0,0,0,.6)}
 #saisie .cible{font-size:12px;color:#0a84ff;font-weight:600;margin-bottom:8px;max-height:90px;overflow:auto;line-height:1.5}
 #saisie textarea{width:100%;height:90px;background:#1c1c1e;border:1px solid #3a3a3c;border-radius:10px;color:#fff;padding:10px;font:inherit;font-size:13px;resize:vertical}
 #saisie .actions{display:flex;gap:8px;margin-top:10px;justify-content:flex-end;align-items:center}
 #pj{flex:1;font-size:12px;color:#30d158;text-align:left;line-height:1.4}
 label.fichier{background:#3a3a3c;color:#fff;border-radius:999px;padding:8px 14px;font-size:13px;font-weight:600;cursor:pointer}
 #fichiers{display:none}
 #calque{position:fixed;top:74px;left:0;right:0;bottom:0;z-index:65;cursor:crosshair;display:none}
 #rectdessin{position:fixed;border:2px solid #30d158;background:rgba(48,209,88,.15);z-index:66;pointer-events:none;border-radius:5px;display:none}
</style></head><body>
 <div id="entete"><div class="barre">
   <button data-w="375" data-h="812">iPhone mini</button>
   <button data-w="393" data-h="852">iPhone Pro</button>
   <button data-w="430" data-h="932">iPhone Pro Max</button>
   <button data-w="820" data-h="1180">iPad</button>
   <button data-w="1180" data-h="820">iPad paysage</button>
   <button id="btn-note">💬 Commenter</button>
   <button id="btn-libre">✍️ Remarque libre</button>
   <button id="btn-zone">⬛ Dessiner une zone</button>
   <button id="btn-liste">Mes remarques (<span id="nb">0</span>)</button>
 </div><div class="taille" id="taille"></div></div>
 <div id="zone"><iframe id="tel" src="/"></iframe></div>
 <div id="calque"></div>
 <div id="rectdessin"></div>
 <div id="panneau"><h3>Mes remarques</h3><div id="liste"></div></div>
 <div id="selListe"></div>
 <div id="selection"><span id="compte"></span><button id="vider">Tout vider</button><button id="ecrire" class="blanc">Écrire la remarque</button></div>
 <div id="saisie"><div class="cible" id="cible"></div><textarea id="txt" placeholder="Explique ce qui ne va pas sur ces éléments, et ce que tu veux à la place…"></textarea><div class="actions"><span id="pj"></span><label class="fichier" for="fichiers">📎 Joindre une capture</label><input id="fichiers" type="file" accept="image/*" multiple><button id="annuler">Annuler</button><button id="ok" class="on">Enregistrer</button></div></div>
</body>`;
localStorage.setItem('lms_remarques', garde);
'html ok';
const cadre=document.getElementById('tel'),t=document.getElementById('taille');
let dev={w:393,h:852};
function poser(w,h,btn){dev={w,h};const e=Math.min(1,(window.innerHeight-120)/h);cadre.style.width=w+'px';cadre.style.height=h+'px';cadre.style.transform='scale('+e+')';cadre.style.transformOrigin='top center';document.getElementById('zone').style.height=Math.round(h*e)+'px';t.textContent=w+' × '+h+' px'+(e<1?' (réduit à '+Math.round(e*100)+' %)':'');document.querySelectorAll('.barre button[data-w]').forEach(b=>b.classList.toggle('on',b===btn));}
document.querySelectorAll('.barre button[data-w]').forEach(b=>b.addEventListener('click',()=>poser(+b.dataset.w,+b.dataset.h,b)));
poser(393,852,document.querySelector('.barre button[data-w="393"]'));
const CLE='lms_remarques';
const lire=()=>{try{return JSON.parse(localStorage.getItem(CLE)||'[]')}catch{return[]}};
const ecrire=n=>localStorage.setItem(CLE,JSON.stringify(n));
const nb=document.getElementById('nb'),liste=document.getElementById('liste'),panneau=document.getElementById('panneau');
const saisie=document.getElementById('saisie'),cible=document.getElementById('cible'),txt=document.getElementById('txt');
const barreSel=document.getElementById('selection'),compte=document.getElementById('compte'),selListe=document.getElementById('selListe');
const champFichiers=document.getElementById('fichiers'),zonePJ=document.getElementById('pj');
let mode=false,choisis=[],listeOuverte=false,pieces=[];
function decrire(el){const s=(el.innerText||'').trim().replace(/\s+/g,' ').slice(0,60);if(s)return '« '+s+' »';if(el.closest('img')||el.querySelector('img'))return 'une image';return el.tagName.toLowerCase();}
function retirer(i){const c=choisis[i];try{if(c.el){c.el.style.outline='';c.el.style.background='';}}catch{}choisis.splice(i,1);majBarre();}
function majBarre(){const n=choisis.length;compte.textContent=n+' élément'+(n>1?'s':'')+(listeOuverte?' ▾':' ▸');barreSel.style.display=n?'flex':'none';if(!n)listeOuverte=false;selListe.style.display=(n&&listeOuverte)?'block':'none';selListe.innerHTML=choisis.map((c,i)=>`<div class="lg"><span class="num">${i+1}</span><span class="txt">${c.page} → ${c.element}</span><span class="x" data-i="${i}">×</span></div>`).join('');selListe.querySelectorAll('.x').forEach(x=>x.onclick=()=>retirer(+x.dataset.i));}
function viderSelection(){choisis.forEach(c=>{try{if(c.el){c.el.style.outline='';c.el.style.background='';}}catch{}});choisis=[];listeOuverte=false;majBarre();}
function majPJ(){zonePJ.textContent=pieces.length?'📎 '+pieces.join(', '):'';}
function rendre(){const n=lire();nb.textContent=n.length;liste.innerHTML=n.length?n.map((r,i)=>{const ou=r.zone?('🟦 Zone · '+r.zone.page+' · '+r.zone.rect.w+'×'+r.zone.rect.h+' px à ('+r.zone.rect.x+','+r.zone.rect.y+')'):(r.elements||[{page:r.page,element:r.element}]).map(e=>e.page+' → '+e.element).join('<br>');const pj=(r.captures&&r.captures.length)?`<span class="pj">📎 ${r.captures.join(', ')}</span>`:'';return `<div class="note"><span class="sup" data-i="${i}">×</span><span class="no">#${i+1}</span><span class="ou">${ou}</span><span class="quoi">${r.texte}</span>${pj}</div>`;}).join(''):'<div class="note">Aucune remarque.</div>';liste.querySelectorAll('.sup').forEach(s=>s.onclick=()=>{const n2=lire();n2.splice(+s.dataset.i,1);ecrire(n2);rendre();});}
function brancher(){const d=cadre.contentDocument;if(!d)return;
 d.addEventListener('mouseover',e=>{if(!mode)return;if(choisis.some(c=>c.el===e.target))return;e.target.style.outline='2px dashed #0a84ff';e.target.style.outlineOffset='-2px';},true);
 d.addEventListener('mouseout',e=>{if(choisis.some(c=>c.el===e.target))return;e.target.style.outline='';},true);
 d.addEventListener('click',e=>{if(!mode)return;e.preventDefault();e.stopPropagation();const i=choisis.findIndex(c=>c.el===e.target);if(i>=0){retirer(i);return;}e.target.style.outline='3px solid #0a84ff';e.target.style.outlineOffset='-3px';e.target.style.background='rgba(10,132,255,.12)';choisis.push({el:e.target,page:cadre.contentWindow.location.pathname,element:decrire(e.target)});majBarre();},true);}
cadre.addEventListener('load',()=>{choisis=choisis.map(c=>({page:c.page,element:c.element,el:null}));majBarre();brancher();});brancher();
compte.onclick=()=>{listeOuverte=!listeOuverte;majBarre();};
champFichiers.onchange=()=>{pieces=[...pieces,...Array.from(champFichiers.files).map(f=>f.name)];majPJ();champFichiers.value='';};
document.getElementById('btn-note').onclick=e=>{mode=!mode;if(mode&&zoneMode){zoneMode=false;majBoutonZone();}e.target.classList.toggle('rouge',mode);e.target.textContent=mode?'💬 Mode remarque ACTIF':'💬 Commenter';};
/* Remarque libre : ouvrir la fenêtre de saisie SANS avoir rien sélectionné.
   Ajouté le 30/07/2026 — jusque-là il fallait désigner au moins un élément à
   l'écran, ce qui empêchait d'écrire ce qui ne se montre pas du doigt : une
   idée, un manque, un comportement attendu. La page affichée est enregistrée
   avec, pour retrouver de quoi on parlait. */
document.getElementById('btn-libre').onclick=()=>{viderSelection();let p='/';try{p=cadre.contentWindow.location.pathname}catch{}cible.textContent='Remarque générale · '+p;txt.value='';pieces=[];majPJ();saisie.style.display='block';txt.focus();};
document.getElementById('btn-liste').onclick=()=>{panneau.style.display=panneau.style.display==='block'?'none':'block';rendre();};
document.getElementById('vider').onclick=viderSelection;
document.getElementById('ecrire').onclick=()=>{cible.innerHTML=choisis.map((c,i)=>(i+1)+'. '+c.page+' → '+c.element).join('<br>');txt.value='';pieces=[];majPJ();barreSel.style.display='none';selListe.style.display='none';saisie.style.display='block';txt.focus();};
document.getElementById('annuler').onclick=()=>{saisie.style.display='none';effacerZoneDessin();pendingZone=null;majBarre();};
/* Une remarque part dès qu'il y a du texte, avec ou sans élément désigné : sans
   sélection elle est rattachée à la page affichée (« remarque générale »). */
document.getElementById('ok').onclick=()=>{const v=txt.value.trim();if(v){const n=lire();if(pendingZone){n.push({zone:pendingZone,texte:v,captures:pieces});}else{let p='/';try{p=cadre.contentWindow.location.pathname}catch{}const ou=choisis.length?choisis.map(c=>({page:c.page,element:c.element})):[{page:p,element:'remarque générale'}];n.push({elements:ou,texte:v,captures:pieces,taille:cadre.style.width});}ecrire(n);}saisie.style.display='none';pieces=[];majPJ();effacerZoneDessin();pendingZone=null;viderSelection();rendre();};
/* ── Dessiner une zone (ajouté 03/08/2026) ───────────────────────────────────
   Tracer un rectangle sur l'écran simulé pour cadrer un design à créer. Le
   rectangle est converti en pixels de l'APPAREIL (indépendants du zoom du
   simulateur), enregistré avec la page affichée et la taille d'appareil, puis
   décrit dans la fenêtre de saisie. Réutilise le même stockage (lms_remarques),
   comme entrée { zone:{page,device,rect}, texte }. Sert à placer une nouvelle
   UI au bon endroit sans deviner. Exclusif avec le mode remarque. */
const calque=document.getElementById('calque'),rectDessin=document.getElementById('rectdessin');
let zoneMode=false,pendingZone=null,dessin=null;
function effacerZoneDessin(){rectDessin.style.display='none';}
function majBoutonZone(){const b=document.getElementById('btn-zone');b.classList.toggle('rouge',zoneMode);b.textContent=zoneMode?'⬛ Zone ACTIVE — trace le rectangle':'⬛ Dessiner une zone';calque.style.display=zoneMode?'block':'none';}
document.getElementById('btn-zone').onclick=()=>{zoneMode=!zoneMode;if(zoneMode&&mode){mode=false;const bn=document.getElementById('btn-note');bn.classList.remove('rouge');bn.textContent='💬 Commenter';}majBoutonZone();};
calque.addEventListener('mousedown',ev=>{if(!zoneMode)return;dessin={sx:ev.clientX,sy:ev.clientY,r:cadre.getBoundingClientRect()};rectDessin.style.display='block';rectDessin.style.left=ev.clientX+'px';rectDessin.style.top=ev.clientY+'px';rectDessin.style.width='0px';rectDessin.style.height='0px';ev.preventDefault();});
window.addEventListener('mousemove',ev=>{if(!dessin)return;const x=Math.min(ev.clientX,dessin.sx),y=Math.min(ev.clientY,dessin.sy);rectDessin.style.left=x+'px';rectDessin.style.top=y+'px';rectDessin.style.width=Math.abs(ev.clientX-dessin.sx)+'px';rectDessin.style.height=Math.abs(ev.clientY-dessin.sy)+'px';});
window.addEventListener('mouseup',ev=>{if(!dessin)return;const d=dessin;dessin=null;const r=d.r,e=r.width/dev.w;
 let x=(Math.min(ev.clientX,d.sx)-r.left)/e,y=(Math.min(ev.clientY,d.sy)-r.top)/e,w=Math.abs(ev.clientX-d.sx)/e,h=Math.abs(ev.clientY-d.sy)/e;
 x=Math.round(Math.max(0,Math.min(x,dev.w)));y=Math.round(Math.max(0,Math.min(y,dev.h)));w=Math.round(Math.min(w,dev.w-x));h=Math.round(Math.min(h,dev.h-y));
 if(w<8||h<8){effacerZoneDessin();return;}
 let p='/';try{p=cadre.contentWindow.location.pathname}catch{}
 pendingZone={page:p,device:{w:dev.w,h:dev.h},rect:{x,y,w,h}};
 cible.textContent='🟦 Zone sur '+p+' — '+w+'×'+h+' px à ('+x+','+y+') sur écran '+dev.w+'×'+dev.h;
 txt.value='';pieces=[];majPJ();txt.placeholder="Décris l'UI/UX voulu dans cette zone…";saisie.style.display='block';txt.focus();
 zoneMode=false;majBoutonZone();
});
rendre();majBarre();majPJ();
'simulateur prêt · ' + lire().length + ' remarques';