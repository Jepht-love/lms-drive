// 14 articles juridiques LMS Agency — source contrat officiel
// Paramètres variables selon catégorie : franchise (Art. 3) et retard €/h (Art. 7)

// Ce texte est imprimé dans un PDF : on formate les montants avec `fmtEntier`
// et jamais avec `toLocaleString`, qui produirait « 15/000 € » (voir nombres.ts).
import { fmtEntier } from '@/lib/pdf/nombres'

export interface LegalArticlesParams {
  franchise: number   // 21000 en sportif, 15000 en citadine, 6000 pour la Smart Fortwo
  retardHeure: number // 150 sport / 50 citadine
  caution: number     // montant réel de la réservation
}

export function getLegalArticles({ franchise, retardHeure, caution }: LegalArticlesParams) {
  return [
    {
      title: '1 - CONDITIONS DE LOCATION',
      body: `Le véhicule devra être restitué dans le même état et les mêmes conditions que celles définies lors de la prise en charge. A défaut les frais de remise en état, tels que dégâts causés par un tiers non identifié, pillage ou vol d'accessoires, dégâts causés aux parties hautes et en dessous du véhicule, jantes et pneumatiques, rayures sur la carrosserie ainsi qu'à l'intérieur (brûlures, salissures et autres...) seront à la charge du locataire.`,
    },
    {
      title: '2 - CONDITIONS D\'UTILISATION',
      body: `LE LOCATAIRE doit signaler au LOUEUR, le ou les conducteurs qui doivent être agrées et nommément désignés au présent contrat. Le ou les conducteurs désignés par le LOCATAIRE doivent impérativement être âgés de plus de 18 ans, et posséder le permis de conduire, régulier et valide depuis plus d'un jour de permis et spécifique pour ledit véhicule. La non transmission du permis de conduire d'un des conducteurs désignés ne permet pas au LOCATAIRE de faire conduire le véhicule loué par un conducteur ad hoc. Le non-respect de cette clause par le LOCATAIRE engage sa responsabilité personnelle et constitue une cause de résiliation du présent contrat.\nA défaut de désignation d'autres conducteurs, le signataire dudit contrat est le seul à être autorisé à conduire le véhicule loué, sous réserve de la présentation de son permis de conduire RÉGULIER ET VALIDE.\nLes conducteurs agrées agissent comme mandataire du LOCATAIRE, qui demeure responsable envers le LOUEUR de l'exécution intégrale du présent contrat, notamment dans les termes de l'article 1242 du Code Civil.\nLe locataire s'engage à n'utiliser le véhicule que pour des besoins personnels ou professionnels à l'exclusion de l'activité de location de véhicule, d'auto-écoles, d'ambulances et de transport de liquides inflammables et ou dangereux, à ne pas transporter de voyageur à titre onéreux, ni en nombre supérieur à celui porté sur la carte grise du véhicule, à ne pas l'utiliser à des fins illicites, à ne pas remorquer d'autre véhicule, à utiliser, lors de chaque arrêt, le dispositif antivol et à fermer le véhicule en conservant les clés et les papiers du véhicule en lieu sûr, à ne pas prêter le véhicule à une tierce personne.\nLe LOCATAIRE est responsable de toutes les contraventions et infractions, aux lois, aux délibérations, arrêtés, et au Code de la Route en vigueur. En tout état de cause, il doit lui-même s'acquitter de ces éventuelles sanctions.\nIl est formellement interdit au LOCATAIRE de transporter dans le véhicule du protoxyde d'azote. En cas de transport de protoxyde d'azote dans le véhicule, le LOCATAIRE est informé que le LOUEUR encaissera la caution, même en l'absence de sinistre.`,
    },
    {
      title: '3 - ASSURANCE',
      body: `Le LOUEUR s'engage, pendant toute la durée de la location, à assurer le véhicule objet des présentes et à fournir au LOCATAIRE tout justificatif. Le LOCATAIRE donne par le présent contrat son accord à ladite police et s'engage à en observer les clauses et conditions. Ladite police couvre les dommages en illimité contre les tiers suivant la règlementation en vigueur. Le LOCATAIRE s'engage de plus, à prendre toutes les mesures utiles pour protéger les intérêts du loueur et de la compagnie d'assurance de celui-ci, en cas d'accident au cours de la durée du présent contrat. Si l'assureur refuse sa garantie, notamment en cas d'infraction au code de la route prouvée, du LOCATAIRE, celui-ci reste tenu personnellement d'indemniser le loueur du préjudice subi, dont le montant est fixé d'un commun accord entre l'expert délégué par l'assurance et le loueur ou toute autre décision de justice.\nLa franchise peut s'élever jusqu'à ${fmtEntier(franchise)} € par sinistre et par véhicule et est applicable sur les garanties Incendie, Vol, Bris de glace et dommages tous accidents. En cas de sinistre, le LOCATAIRE s'engage à payer au LOUEUR les réparations des dommages du fait de collision ou autre cause au dit véhicule à concurrence du montant de la franchise.\nDans le cas où le LOCATAIRE, de par son activité professionnelle, telle qu'ambulancier ou d'auto-école lesquels sont par nature exclue par la police d'assurance couvrant le présent contrat, il est convenu que le LOCATAIRE assurera par ses propres moyens le bien loué sur une garantie équivalente. A ce titre, il devra fournir préalablement à la livraison du bien, une délégation d'assurance au profit du LOUEUR. Il reste entendu que le LOCATAIRE demeure seul responsable des sinistres et de ses conséquences notamment en cas de non prise en charge, totale ou partielle, par son assurance et s'engage à les supporter personnellement.`,
    },
    {
      title: '4 - ÉTAT DU VÉHICULE',
      body: `Le véhicule est livré en bon état de marche et de carrosserie avec pneumatiques dont la roue de secours en bon état, accessoires normaux et papiers du véhicule.\nA ce titre, toute réserve éventuelle devra impérativement être formulée par le LOCATAIRE lors de la visite de l'état du véhicule, préalable à la prise en possession dudit bien et donc sur le document « ETAT DESCRIPTIF DU VEHICULE » ci-annexé qui sera signé par les deux parties.\nLe LOCATAIRE s'engage à restituer le véhicule dans le même état, à défaut il devra acquitter le montant de la remise en état, ainsi que de tous les éventuels frais listés dans le tableau récapitulatif des frais pouvant être facturés annexé au présent contrat.\nLes niveaux de carburant sont indiqués également sur ce même document au départ et au retour du véhicule. Le plein de carburant est effectué au départ du véhicule par le LOUEUR et devra être refait aux frais du LOCATAIRE, à la restitution de celui-ci. En cas contraire, le complément sera facturé au LOCATAIRE au tarif du moment.\nDans le cas d'un trajet court de moins de 80 km, le LOCATAIRE devra effectuer le plein du véhicule et présenter la facture au LOUEUR afin d'éviter la facturation de frais complémentaires.`,
    },
    {
      title: '5 - ENTRETIEN',
      body: `Les réparations, échanges de pièces ou de pneumatiques résultant de l'usure normale, sont à la charge du LOUEUR et seront effectuées par ses soins.\nLes réparations, quelque soient leur nature, échanges de pièces ou fournitures, résultant d'une usure anormale, de la négligence, de cause accidentelle ou indéterminée, demeurent à la charge du LOCATAIRE qui déclare en accepter toute la responsabilité.\nLe LOCATAIRE s'engage à entretenir le matériel en parfait état de fonctionnement, et notamment, sans que la liste soit limitative : vérification du niveau d'huile, d'eau et autres fluides avec obligation de refaire les niveaux, pression des pneus.\nLe véhicule ne pourra être modifié ou réparé sans l'accord écrit préalable du LOUEUR.`,
    },
    {
      title: '6 - SINISTRE',
      body: `En cas de sinistre, le LOCATAIRE doit obligatoirement faire procéder à un constat de police ou de gendarmerie.\nLe LOCATAIRE s'engage à faire une déclaration écrite, au LOUEUR par tout moyen, dans les 24 heures du sinistre. Cette déclaration comprendra tous les renseignements relatifs aux circonstances – heure et date - du sinistre, à l'identité des parties et des témoins.\nEn cas de vol et incendie, le LOCATAIRE devra en informer le LOUEUR sans délai avec preuve écrite de cette information.\nDurant la location, le LOCATAIRE est entièrement redevable et responsable à l'égard du LOUEUR, des dommages de quelque nature qu'ils soient : occasionnés aux tiers et à son propre personnel, du fait de l'utilisation du véhicule, ou dû au non-respect des consignes d'utilisation, ce, quelles que soient les circonstances et notamment, sans que la liste soit limitative : en cas de négligence avérée ou notoire du conducteur, ou lorsque le conducteur est sous l'emprise d'un état alcoolique ou de stupéfiant, ou l'effet d'éléments modifiant les réflexes indispensables à la conduite, au loueur et notamment en cas d'endommagement du véhicule, quelle qu'en soit la cause et quel qu'en soit l'auteur.`,
    },
    {
      title: '7 - DURÉE',
      body: `La durée de la présente location est précisée à l'article 3.\nUn retard de 60 minutes pourra être accordé par le LOUEUR, sans frais supplémentaire pour le LOCATAIRE. Au-delà, il sera facturé ${retardHeure} euros / heure.\nLe LOCATAIRE doit demander au LOUEUR, au moins 24 heures à l'avance, la prolongation de sa location, ce en l'accompagnant de la provision correspondante. Si le véhicule n'est pas restitué à l'échéance convenue, le contrat de location peut être résilié de plein droit par le LOUEUR, ce aux frais du LOCATAIRE.`,
    },
    {
      title: '8 - RESTITUTION',
      body: `Le véhicule sera ramené au LOUEUR par les soins du LOCATAIRE, et aux frais de ce dernier.\nDans l'hypothèse, où le LOUEUR est amené à récupérer le véhicule pour quelque raison que se soit, du fait du LOCATAIRE, les frais engagés par le LOUEUR à ce titre, tels que, sans que la liste soit exhaustive : les frais d'enlèvement, les frais de transport et/ou de remorquage, etc seront dus par le LOCATAIRE.\nLA RESTITUTION DEVRA ÊTRE effectuée pendant les heures d'ouverture du Loueur, à savoir : 9 heures à 18 heures du lundi au samedi. Dès le retour de véhicule, un état de restitution sera effectué et signé par les parties sur la part correspondant du document « ETAT DESCRIPTIF DU VEHICULE ». Si le véhicule est rendu en dehors des heures ouvrables, le LOCATAIRE reste responsable de l'état du véhicule jusqu'à l'ouverture des locaux du LOUEUR. Si le preneur ne peut restituer les papiers du véhicule, il devra acquitter le coût du prêt jusqu'à la production par lui d'une attestation officielle de perte ou de vol, ainsi que les frais de délivrance des duplicatas.`,
    },
    {
      title: '9 - LE PRIX',
      body: `Le prix de la location est payable d'avance.`,
    },
    {
      title: '10 - DÉPÔT DE GARANTIE',
      body: `De convention expresse, le montant du dépôt de garantie est fixé à ${fmtEntier(caution)} euros. Celui-ci est attribué au LOUEUR en toute propriété, à concurrence des sommes dues à un titre quelconque par le LOCATAIRE. Si ces sommes dépassent le montant du dépôt de garantie, pour quelque motif que ce soit, le règlement du solde par le LOCATAIRE devra intervenir dans un délai maximum de 15 jours à compter de la demande écrite du LOUEUR. Le LOCATAIRE qui aura été exempté du paiement du dépôt de garantie s'engage à se soumettre aux conditions énumérées ci-dessus.`,
    },
    {
      title: '11 - CLAUSE PÉNALE',
      body: `LE LOCATAIRE est responsable de tous les frais occasionnés par le recouvrement éventuel du prix de la location, indemnités, frais, pénalités, ainsi que tous les frais de justice engagés par le LOUEUR résultant par lui de l'inexécution du présent bail.\nEn cas de procédure pour le non-paiement des sommes résultant du présent contrat, et de convention expresse le LOCATAIRE devra en outre au LOUEUR, une somme égale à 30 % du montant dû, à titre de clause pénale.`,
    },
    {
      title: '12 - RÉSERVE DE PROPRIÉTÉ',
      body: `Le véhicule loué est et reste l'entière propriété du LOUEUR. Les plaques de propriétés apposées sur le matériel loué, ni les inscriptions portées sur celui-ci ne doivent être enlevées ou modifiées par le LOCATAIRE. Le LOCATAIRE s'interdit de céder, donner en gage, en nantissement, ou sous-location ou de disposer de quelque manière que ce soit du véhicule loué. Si un tiers tentait de faire valoir des droits sur ledit véhicule, sous la forme de revendication, d'une opposition ou d'une saisie, le locataire est tenu d'en informer dans les plus brefs délais le LOUEUR. En cas d'inobservation de cette obligation, le LOCATAIRE serait responsable de tout préjudice qui pourrait en résulter.`,
    },
    {
      title: '13 - CLAUSE DE RÉSILIATION',
      body: `A défaut du paiement du prix ou par suite d'inexécution d'une seule des clauses ou conditions du bail et après une mise en demeure par lettre recommandée avec accusé réception de payer ou d'exécuter lesdites clauses, restées sans effet pendant 48 heures, le présent bail sera résilié de plein droit s'il plaît au LOUEUR.\nAu cas où le LOCATAIRE ne restituerait pas le bien loué, après la résiliation ou l'expiration du bail l'indemnité journalière de jouissance, à laquelle il s'oblige expressément, est fixée à 15 000 euros.`,
    },
    {
      title: '14 - ATTRIBUTION DE COMPÉTENCE',
      body: `Tout différend relatif à la conclusion, l'exécution, l'interprétation et/ou la rupture du présent contrat sera tranché définitivement par les Tribunaux de Paris.`,
    },
  ]
}

// « et/ou » : le logiciel produit des photos horodatées ; la vidéo reste possible
// sur le terrain. Écrire « et » promettrait les deux au client à chaque location,
// donc une preuve que le logiciel ne fabrique pas systématiquement.
export const VIDEO_CLAUSE = `L'état des lieux du véhicule mis à disposition sera effectué par photos horodatées et/ou par vidéo lors de la remise et de la restitution du véhicule. Ces éléments seront immédiatement transmis au locataire et conservés par les deux parties à titre de preuve et de justificatif. Ils pourront être utilisés en cas de constatation de dommages, de litige ou de contestation concernant l'état du véhicule avant, pendant ou après la période de location.`

/**
 * Tableau « MONTANT DES FRAIS POUVANT ETRE FACTURES » — annexe du contrat.
 *
 * Reproduit à l'identique les contrats papier 2026 (« contrat sportif new » et
 * « Contrat citadine new »), dans le même ordre et avec les mêmes libellés :
 * les 27 lignes doivent correspondre ligne pour ligne, sinon le PDF généré ne
 * vaut pas le contrat signé.
 *
 * Deux barèmes distincts. Les sportifs ne sont PAS une simple majoration des
 * citadines : certaines lignes changent de nature (frais de gestion en % côté
 * sportif, en euros côté citadine).
 */
/**
 * Les deux montants du contrat que la grille tarifaire peut désormais fixer.
 *
 * ⚠️ **Un contrat déjà signé ne change jamais.** Ces valeurs doivent être
 * recopiées dans le contrat au moment de la signature, et relues telles quelles
 * ensuite. Les passer ici sert aux contrats À VENIR ; un contrat de juillet ne
 * doit pas afficher les tarifs d'août (règle de Jeff, 03/08/2026).
 */
export interface MontantsContrat {
  /** Franchise, toutes lignes de franchise du tableau. */
  franchise?: number | null
  /** Tarif horaire du retard de restitution. */
  retardHeure?: number | null
}

export function getFeesTable(
  category: string,
  isSmartFortwo = false,
  montants?: MontantsContrat | null,
) {
  const isSport = category === 'sportif'
  // Franchise : 21 000 € en sportif, 15 000 € en citadine, 6 000 € pour la Smart
  // Fortwo. Le contrat papier « sportif » se contredit — son article 3 annonce
  // 15 000 € quand son tableau des frais dit 21 000 €. Arbitré une première fois
  // le 26/07/2026 en faveur de 15 000 €, PUIS REPRIS PAR JEFF LE 30/07/2026 :
  // c'est le tableau qui fait foi, 21 000 €, et c'est l'article 3 du contrat
  // papier qui est faux. Ne pas revenir à 15 000 € sans le lui redemander.
  //
  // Depuis le 03/08/2026, ces valeurs ne sont plus que le DERNIER RECOURS : la
  // grille tarifaire du véhicule les fixe quand elle en porte. C'est ce qui
  // permet au gérant de changer sa franchise sans passer par un développeur.
  const utile = (v: number | null | undefined): v is number => v != null && Number.isFinite(v)
  const franchise = utile(montants?.franchise)
    ? montants!.franchise!
    : isSmartFortwo ? 6000 : isSport ? 21000 : 15000
  const retard = utile(montants?.retardHeure)
    ? montants!.retardHeure!
    : isSport ? 150 : 50

  // Côté citadine, le contrat mentionne l'exception Smart Fortwo dans la case
  // elle-même. On l'affiche uniquement quand le véhicule loué n'est pas la Smart
  // (pour elle, le montant applicable est déjà le bon).
  // Mise en forme française : « 21 000 € ». Dès que la grille fixe la franchise,
  // le texte suit sa valeur — y compris la mention de l'exception, qui n'aurait
  // plus de sens si le gérant a rangé ses voitures autrement.
  // `fmtEntier` et jamais `toLocaleString` : dans un PDF, ce dernier écrit
  // « 15/000 € » (avertissement en tête de ce fichier).
  const euros = (n: number) => `${fmtEntier(n)} €`
  const franchiseTxt = utile(montants?.franchise)
    ? euros(franchise)
    : isSmartFortwo
      ? '6 000 €'
      : isSport
        ? '21 000 €'
        : '15 000 € (sauf Smart Fortwo : 6 000 €)'
  const retardTxt = `${euros(retard)} par heure de retard`

  const rows = isSport
    ? [
        { label: 'Franchise responsabilité civile', value: franchiseTxt },
        { label: 'Franchise dommage', value: franchiseTxt },
        { label: 'Franchise vol', value: franchiseTxt },
        { label: 'Franchise carburant', value: 'Selon écart + 50 € de frais de service' },
        { label: 'Rayure légère', value: '500 €' },
        { label: 'Rayure profonde', value: '800 €' },
        { label: 'Rayure par jantes', value: '500 €' },
        { label: 'Fissure jantes', value: '800 €' },
        { label: 'Casse anormale mécanique', value: 'Sur devis + 50 % de frais' },
        { label: 'Retard restitution du véhicule', value: retardTxt },
        { label: 'Nettoyage véhicule intérieur / extérieur', value: '100 € ou sur devis si le montant des frais de nettoyage est supérieur' },
        { label: 'Déchirure et brûlure / tâches sièges / plafonnier', value: '1 000 € par élément ou sur devis si le montant des frais de remise en état est supérieur' },
        { label: 'Odeur cigarette ou autre', value: '500 €' },
        { label: 'Perte clés du véhicule', value: '500 €' },
        { label: 'Utilisation anormale du véhicule (circuit, drift run, course-poursuite…)', value: '5 000 €' },
        { label: 'Usure anormale pneu (crevaison, hernie, abîmé)', value: '700 €' },
        { label: 'Usure anormale freinage', value: '800 €' },
        { label: 'Contravention au Code de la route', value: 'Montant de la contravention + 50 % de frais de gestion' },
        { label: 'Frais de sortie de fourrière', value: 'Frais facturés par la fourrière + 200 € de frais de déplacement et de gestion' },
        { label: 'Frais de saisie judiciaire', value: '500 € par jour d\'immobilisation' },
        { label: 'Franchise incendie', value: franchiseTxt },
        { label: 'Jour d\'immobilisation pour réparation', value: '500 €' },
        { label: 'Dommage carrosserie', value: 'Sur devis + 50 %' },
        { label: 'Pare-brise, vitre cassé', value: '5 000 €' },
        { label: 'Tapis manquant', value: '300 €' },
        { label: 'Frais juridique', value: 'Coût de la procédure + 50 %' },
        // Le contrat papier imprime « 10 00€ » — coquille de saisie, lue comme 1 000 €.
        { label: 'Erreur carburant (Gazole, éthanol interdit)', value: '1 000 €' },
      ]
    : [
        { label: 'Franchise responsabilité civile', value: franchiseTxt },
        { label: 'Franchise dommage', value: franchiseTxt },
        { label: 'Franchise vol', value: franchiseTxt },
        { label: 'Franchise carburant', value: 'Selon écart + 20 € de frais de service' },
        { label: 'Rayure légère', value: '300 €' },
        { label: 'Rayure profonde', value: '500 €' },
        { label: 'Rayure par jantes', value: '300 €' },
        { label: 'Fissure jantes', value: '500 €' },
        { label: 'Casse anormale mécanique', value: 'Sur devis + 30 % de frais' },
        { label: 'Retard restitution du véhicule', value: retardTxt },
        { label: 'Nettoyage véhicule intérieur / extérieur', value: '50 € ou sur devis si le montant des frais de nettoyage est supérieur' },
        { label: 'Déchirure et brûlure / tâches sièges / plafonnier', value: '200 € par élément ou sur devis si le montant des frais de remise en état est supérieur' },
        { label: 'Odeur cigarette ou autre', value: '300 €' },
        { label: 'Perte clés du véhicule', value: '300 €' },
        { label: 'Utilisation anormale du véhicule (circuit, drift run, course-poursuite…)', value: '5 000 €' },
        { label: 'Usure anormale pneu (crevaison, hernie, abîmé)', value: '400 €' },
        { label: 'Usure anormale freinage', value: '300 €' },
        { label: 'Contravention au Code de la route / Péage', value: 'Montant de la contravention + 50 € de frais de gestion' },
        { label: 'Frais de sortie de fourrière', value: 'Frais facturés par la fourrière + 200 € de frais de déplacement et de gestion' },
        { label: 'Frais de saisie judiciaire', value: '70 € par jour d\'immobilisation' },
        { label: 'Franchise incendie', value: franchiseTxt },
        { label: 'Jour d\'immobilisation pour réparation', value: '70 €' },
        { label: 'Dommage carrosserie', value: 'Sur devis + 30 %' },
        { label: 'Pare-brise, vitre cassé', value: '1 000 €' },
        { label: 'Tapis manquant', value: '150 €' },
        { label: 'Frais juridique', value: 'Coût de la procédure + 30 %' },
        { label: 'Erreur carburant (Gazole, éthanol interdit)', value: '200 €' },
      ]

  return { franchise, retard, rows }
}
