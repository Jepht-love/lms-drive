/**
 * Les mentions légales imprimées au bas de la facture de restitution.
 *
 * Source unique : le PDF (`lib/pdf/invoice-template.tsx`) et la prévisualisation
 * à l'écran (`app/(dashboard)/reservations/[id]/facture/`) lisent ce fichier.
 * Sorties le 03/08/2026 du modèle PDF, où elles vivaient seules : l'aperçu écran
 * les aurait autrement recopiées, et deux textes juridiques auraient divergé au
 * premier ajustement.
 *
 * Ne dépend de rien (ni react-pdf, ni Supabase) : c'est ce qui permet au
 * composant client de l'importer sans embarquer le moteur PDF dans le navigateur.
 */
export const MENTIONS_LEGALES_FACTURE = (companyName: string) => [
  "La présente facture fait suite à la restitution du véhicule mentionné ci-dessus et aux constatations effectuées lors de l'état du véhicule au retour, conformément aux conditions prévues dans le contrat de location préalablement signé par le client.",
  "Les frais facturés correspondent aux dommages constatés, frais annexes, immobilisation du véhicule et prestations nécessaires à la remise en état, tels que prévus par les conditions générales du contrat de location accepté par le client.",
  "Le règlement de la présente facture est exigible dans un délai maximum de 15 jours à compter de sa date d'émission.",
  "À défaut de paiement dans ce délai, des pénalités de retard seront appliquées conformément aux articles 1231-6 et 1344-1 du Code civil, calculées sur la base du taux d'intérêt légal en vigueur.",
  "Conformément à l'article L441-10 du Code de commerce, tout retard de paiement pourra également entraîner l'application d'une indemnité forfaitaire pour frais de recouvrement de 40 euros, sans préjudice de toute indemnisation complémentaire en cas de frais supérieurs.",
  `À défaut de règlement dans les délais impartis, ${companyName} se réserve le droit d'engager toute procédure de recouvrement amiable ou judiciaire, ainsi que la transmission du dossier à un organisme de recouvrement ou à un officier ministériel compétent.`,
  'La présente facture vaut mise en demeure de paiement.',
]
