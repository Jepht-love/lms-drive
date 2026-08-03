# Distribuer une app native FleetLive en Ad Hoc (over-the-air)

Fiche de procédure réutilisable. Sert à installer l'enveloppe native iOS sur les
appareils d'une équipe **à distance, par lien Safari**, sans câble, sans TestFlight,
sans passer par l'App Store. Chemin destiné aux clients qui veulent une vraie app
native et acceptent le budget compte développeur.

Rappel : l'enveloppe n'embarque pas le logiciel, elle ouvre le site en ligne
(`capacitor.config.ts`, `server.url`). Une fois posée, les corrections déployées
sur Vercel arrivent sans réinstallation. Le build ne resert que pour un ajout
d'appareil, un changement d'enveloppe (icône, nom, permission native) ou le
renouvellement annuel.

---

## Ce qu'il faut par client — les 3 valeurs qui changent

| Valeur | Où | Exemple LMS Drive |
|---|---|---|
| `appId` (bundle id) | `capacitor.config.ts` + Xcode | `com.fleetlive.lmsdrive` |
| `appName` | `capacitor.config.ts` + Xcode | `LMS DRIVE` |
| `server.url` | `capacitor.config.ts` | `https://lms-drive.vercel.app` |

Un client = un bundle id distinct, une URL Vercel distincte. Le reste de la
procédure est identique.

---

## Prérequis (une fois)

- Compte **Apple Developer payant** (99 $/an). Ad Hoc en a besoin.
- **UDID** de chaque appareil cible collecté (voir plus bas).
- Xcode installé, projet iOS présent (`ios/App/App.xcodeproj`).

---

## Étape 1 — Récupérer l'UDID de chaque appareil (à distance)

L'utilisateur ouvre dans **Safari** un site type `udid.tech` ou `get.udid.io`,
un petit profil se pose, le site lit l'UDID, il te l'envoie. Aucun câble.
(Alternative câble : brancher l'appareil, Xcode > Window > Devices, l'UDID s'affiche.)

Garde une **liste cumulée** des UDID : chaque nouvel appareil s'ajoute à la liste
complète, jamais isolé.

## Étape 2 — Enregistrer les appareils dans le compte

developer.apple.com > Certificates, Identifiers & Profiles > **Devices** > **+** >
coller nom + UDID de chaque appareil. Limite : **100 appareils/an**.

## Étape 3 — Préparer le build

```bash
# depuis la racine du dépôt, si un plugin natif a changé
npx cap sync ios
```

Le contenu web n'a pas à être synchronisé : l'app pointe vers `server.url`.
Dans Xcode, cible **App** > **General** > incrémenter **Version** et **Build**
(propre pour tracer les versions installées).

## Étape 4 — Archiver

1. Xcode : sélecteur de destination en haut → **Any iOS Device (arm64)**
   (surtout pas un simulateur, sinon "Archive" est grisé).
2. Menu **Product > Archive**.
3. La fenêtre **Organizer** s'ouvre sur l'archive produite.

## Étape 5 — Exporter en Ad Hoc

1. Dans Organizer, archive sélectionnée → **Distribute App**.
2. Choisir **Release Testing** (c'est le nom du Ad Hoc dans Xcode récent :
   signe avec un profil de distribution limité aux UDID enregistrés).
3. **Automatically manage signing** → Next → **Export**.
4. Xcode produit un dossier contenant **`App.ipa`**.

## Étape 6 — Créer le manifest OTA

À côté du `.ipa`, créer un fichier **`manifest.plist`**. Remplacer les 3 URL et
les 2 valeurs `bundle-identifier` / `title` par celles du client.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>items</key>
  <array>
    <dict>
      <key>assets</key>
      <array>
        <dict>
          <key>kind</key>
          <string>software-package</string>
          <key>url</key>
          <string>https://TON-HOTE/lms-drive/App.ipa</string>
        </dict>
        <dict>
          <key>kind</key>
          <string>display-image</string>
          <key>url</key>
          <string>https://TON-HOTE/lms-drive/icon-57.png</string>
        </dict>
        <dict>
          <key>kind</key>
          <string>full-size-image</string>
          <key>url</key>
          <string>https://TON-HOTE/lms-drive/icon-512.png</string>
        </dict>
      </array>
      <key>metadata</key>
      <dict>
        <key>bundle-identifier</key>
        <string>com.fleetlive.lmsdrive</string>
        <key>bundle-version</key>
        <string>1.0.0</string>
        <key>kind</key>
        <string>software</string>
        <key>title</key>
        <string>LMS DRIVE</string>
      </dict>
    </dict>
  </array>
</dict>
</plist>
```

Les deux images (57×57 et 512×512 px) sont facultatives mais propres : elles
s'affichent pendant l'install. Sans elles, remplacer les deux blocs image par rien.

## Étape 7 — Héberger en HTTPS, à une URL fixe

Poser `App.ipa` + `manifest.plist` (+ icônes) sur un hôte **HTTPS** (obligatoire).
Un dossier statique sur Vercel suffit. **URL fixe par client** : à chaque rebuild,
on écrase le `.ipa` au même chemin, le lien d'install ne change jamais.

## Étape 8 — Le lien d'installation

Envoyer à l'utilisateur ce lien (ouvert dans **Safari**, pas Chrome) :

```
itms-services://?action=download-manifest&url=https://TON-HOTE/lms-drive/manifest.plist
```

Le plus simple : une petite page HTTPS avec un bouton `<a href="itms-services://...">Installer</a>`.
Il tape le bouton → iOS propose l'install → l'app se pose. **Pas de Mode
développeur requis** (profil de distribution, pas de développement).

---

## Ajouter un utilisateur plus tard

1. Récupérer son UDID (étape 1), l'ajouter dans Devices (étape 2).
2. Ré-archiver + ré-exporter avec la **liste complète** des UDID (étapes 4-5).
3. **Écraser** le `.ipa` à l'URL fixe (étape 7).
4. Le nouveau clique le **même lien**. Les anciens déjà installés ne touchent à rien.

Le lien ne change jamais, mais le `.ipa` derrière doit contenir l'UDID de celui
qui clique, sinon l'install échoue.

## Renouvellement annuel

Le profil de distribution vaut ~**1 an**. À l'échéance : ré-archiver, ré-exporter,
écraser le `.ipa`. **Tous** réinstallent une fois par le lien. Entre-temps le
contenu reste à jour (l'app ouvre le site en ligne).

---

## Comparaison des chemins d'installation

| Chemin | Câble | Mode dév. requis | Validité | Pour |
|---|---|---|---|---|
| **Câble Xcode** (Run) | Oui | Oui (iOS 16+) | ~1 an | 1-2 appareils sur place |
| **Ad Hoc OTA** (cette fiche) | Non | Non | ~1 an | équipe à distance, app native |
| **TestFlight** | Non | Non | 90 j/build | test avant App Store (écarté) |
| **App Store** | Non | Non | illimité | publication publique |
