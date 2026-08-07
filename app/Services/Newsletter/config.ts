/**
 * Constantes de la séquence du bon de 15 €. Module PUR : aucune dépendance Adonis, pour que
 * les tests dorés puissent le charger sans monter l'application.
 *
 * Tout ce qui est réglable est ici, et RIEN n'est réglable ailleurs. Chercher une durée dans
 * trois fichiers, c'est la meilleure façon d'en changer deux sur trois.
 */

/**
 * ⛔ LE MARQUEUR DE FINALITÉ — la valeur la plus importante du dispositif.
 *
 * La boutique compte ~750 abonnés dormants, marqués `SUBSCRIBED` chez Shopify, jamais
 * sollicités depuis des mois. Une règle « Shopify dit oui, j'envoie » les réveillerait tous :
 * rebonds à deux chiffres et plaintes sur un domaine d'envoi neuf, c'est-à-dire la mort du
 * canal en une seule salve. Ils n'ont pas de ligne dans `newsletter_subscribers` : ils sont
 * hors d'atteinte par CONSTRUCTION, pas par filtre.
 */
export const PURPOSE = 'bon15'

/** Les cinq langues du lancement. `fr` est la source et le repli. */
export const LOCALES = ['fr', 'en', 'de', 'es', 'nl'] as const
export type NewsletterLocale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: NewsletterLocale = 'fr'

// --- Le bon ------------------------------------------------------------------------------

/**
 * 7 jours d'affichage, comptés en DATE et non en instant.
 *
 * ⚠️ CETTE VALEUR ET `SEQUENCE_GAP_DAYS` SONT LIÉES, et le lien n'est pas cosmétique. E3 dit
 * « vos 15 € s'arrêtent demain » : il doit donc partir la veille de la date annoncée. À J+7,
 * E3 tomberait le jour même de l'expiration et annoncerait une échéance FAUSSE — exactement ce
 * qui fait cliquer sur « signaler comme spam », et une plainte à ce volume représente dix fois
 * le seuil contractuel de SES. Si l'une bouge, l'autre bouge.
 */
export const VOUCHER_VALIDITY_DAYS = 7

/**
 * Fuseau de référence pour calculer la DATE ANNONCÉE au client.
 *
 * ⛔ La date annoncée se calcule en Europe/Paris, jamais en « UTC+2 » figé : entre le dernier
 * dimanche d'octobre et celui de mars, la France est à UTC+1. Un décalage codé en dur ferait
 * dériver la date annoncée d'un jour pendant tout l'hiver, sur les inscriptions du soir.
 */
export const VOUCHER_TIMEZONE = 'Europe/Paris'

/**
 * Heure UTC de fin du bon, posée sur le LENDEMAIN de la date annoncée (cf. `expiry.ts`).
 *
 * ⛔ NE PAS « CORRIGER » CE DÉCALAGE EN LE SUPPRIMANT. Le bon est ouvert aux États-Unis, au
 * Canada, à la Suisse et au Royaume-Uni. Une expiration calée sur 23 h 59 heure de Paris
 * tuerait le code à 14 h 59 l'après-midi pour un client de Los Angeles, alors que l'e-mail lui
 * annonce « valable jusqu'au 13 août inclus ». 11:59:59 UTC correspond à la fin de la journée
 * annoncée dans le dernier fuseau habité de la planète (UTC−12) : la promesse devient vraie de
 * Honolulu à Helsinki. En Europe le bon vit quelques heures de plus que strictement annoncé —
 * une sur-promesse inoffensive, jamais l'inverse.
 */
export const VOUCHER_END_HOUR_UTC = 11
export const VOUCHER_END_MINUTE_UTC = 59
export const VOUCHER_END_SECOND_UTC = 59

/**
 * Étiquette posée sur la fiche client Shopify, pour que le marchand puisse filtrer ses
 * inscrits par source dans son admin.
 *
 * ⛔ Elle se pose par une SECONDE mutation (`tagsAdd`), jamais via `tags` dans `customerSet` :
 * sur les champs listes, « all existing entries not included will be deleted » — la transmettre
 * à `customerSet` effacerait la segmentation d'un client déjà existant. `tagsAdd` ajoute sans
 * écraser.
 */
export const CUSTOMER_TAG = 'promo-popup'

/**
 * Alphabet sans ambiguïté : ni `I`, ni `O`, ni `0`, ni `1`. Le code sera lu à voix haute et
 * recopié à la main sur un téléphone — un `O` pris pour un `0` devient un e-mail au SAV.
 * 32 symboles sur 6 positions = 1,07 milliard de codes.
 */
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const CODE_PREFIX = 'MERCI-'
export const CODE_LENGTH = 6

// --- La séquence -------------------------------------------------------------------------

export const SEQUENCE_LENGTH = 3

/**
 * Délai entre l'envoi RÉEL d'un e-mail et l'échéance du suivant : 3 jours après E1, 3 jours
 * après E2. Une séquence à l'heure tombe donc exactement à J+3 et J+6.
 *
 * ⚠️ E3 EST À J+6 PARCE QUE LE BON VIT 7 JOURS — les deux valeurs sont liées (cf.
 * `VOUCHER_VALIDITY_DAYS`). À J+7 le code expirerait le jour même de l'envoi, alors que
 * l'e-mail annonce « vos 15 € s'arrêtent demain ». À J+6, l'échéance annoncée est exacte.
 *
 * ⛔ Ce sont des écarts, PAS des décalages depuis l'inscription — et c'est la différence
 * entre un rattrapage propre et une salve. Après une panne de quatre jours, des décalages
 * calculés depuis l'inscription rendraient E1, E2 et E3 « dus » en même temps : trois e-mails
 * commerciaux en quarante-cinq minutes, à tout l'arriéré d'un coup.
 *
 * Index 0 = écart après E1, index 1 = écart après E2.
 */
export const SEQUENCE_GAP_DAYS = [3, 3] as const

/**
 * ⛔ PLANCHER ABSOLU entre deux e-mails à une même personne. Dernière ligne de défense : même
 * si un calcul d'échéance se trompe, même si deux tours se chevauchent, même si quelqu'un
 * rejoue le cron à la main, personne ne peut recevoir deux e-mails à moins de 24 heures.
 * Vérifié à la fois dans la requête de sélection ET au moment de réserver la ligne d'envoi.
 */
export const MIN_HOURS_BETWEEN_EMAILS = 24

/**
 * Au-delà, une échéance est trop vieille pour être honorée : on classe l'étape en `skipped`
 * et on passe à la suivante. Envoyer « votre bon vous attend » dix jours en retard n'a plus
 * de sens pour le lecteur — et c'est le lecteur surpris qui clique sur « signaler comme
 * spam ».
 */
export const MAX_STALENESS_DAYS = 7

/**
 * Plafond d'envois par passage du cron. Borne la reprise après panne : mieux vaut résorber
 * un arriéré sur quelques heures que faire d'un domaine neuf un expéditeur en volume du jour
 * au lendemain. À 120 envois/semaine, ce plafond n'est jamais atteint en régime normal.
 */
export const MAX_SENDS_PER_TICK = 20

/**
 * Marge minimale d'utilisation exigée AVANT d'envoyer, e-mail par e-mail. Un message qui vante
 * un bon périmé avant que la personne ait eu le temps de choisir une œuvre est pire que pas de
 * message du tout.
 *
 * ⛔ CE SEUIL EST PAR E-MAIL, ET IL DOIT LE RESTER — un seuil unique à 72 h TUERAIT E3.
 * Faisons le calcul, parce que c'est exactement le genre de régression qui ne se voit pas :
 * avec un bon de 7 jours, il reste entre 38 h et 62 h de validité au moment où E3 part (J+6).
 * Un plancher unique à 72 h classerait donc SYSTÉMATIQUEMENT E3 en « bon proche de
 * l'expiration » et fermerait la séquence — le dernier rappel, celui qui convertit, ne
 * partirait jamais, et rien dans les compteurs ne ressemblerait à une panne.
 *
 *   index 0 — E1 : porte le bon ET le lien de désabonnement. Traité à part dans la porte
 *                  (envoyé tant qu'il reste la moindre validité) : ne pas l'envoyer laisserait
 *                  quelqu'un qui vient de donner son adresse sans rien du tout.
 *   index 1 — E2 (J+3) : il reste alors 110 à 134 h. 72 h passe largement.
 *   index 2 — E3 (J+6) : « dernière chance, il s'arrête demain » — c'est vrai entre 24 et 48 h.
 *                  En dessous de 24 h le message n'a plus d'objet et on saute.
 */
export const MIN_HOURS_BEFORE_EXPIRY = [0, 72, 24] as const

/** Marge exigée pour l'e-mail `emailNo` (1|2|3). Repli sur la plus stricte si hors bornes. */
export function minHoursBeforeExpiry(emailNo: number): number {
  return MIN_HOURS_BEFORE_EXPIRY[emailNo - 1] ?? 72
}

/**
 * Délai de grâce avant de classer une ligne `sending` orpheline (plantage entre la
 * réservation et l'envoi). Statut TERMINAL `unknown` : jamais relancée. On assume l'envoi au
 * plus une fois — un doublon coûte une plainte, un e-mail manquant ne coûte rien.
 */
export const STUCK_SEND_GRACE_MINUTES = 30

/**
 * Au-delà, on alerte : le dispositif n'arrive plus à parler à Shopify et REPORTE tous ses
 * envois (il n'en saute aucun, il attend). Sans alerte, l'attente serait indistinguable du
 * calme plat.
 */
export const SYNC_ALERT_AFTER_HOURS = 6

/** Rétention de la liste repoussoir. Une PLAINTE, elle, n'expire jamais. */
export const SUPPRESSION_RETENTION_YEARS = 3

/**
 * Rétention des données personnelles (adresse en clair, IP, agent utilisateur, page
 * d'origine). Au-delà, elles sont effacées et il ne reste que le squelette anonyme du
 * consentement — assez pour démontrer qu'un consentement a existé (art. 7(1)), plus assez
 * pour identifier quiconque.
 *
 * Cette purge est AUTOMATIQUE et c'est indispensable : les trois webhooks RGPD de Shopify ne
 * sont pas souscriptibles pour une app créée depuis l'admin (§0.4). Sans purge programmée,
 * le dispositif accumulerait des adresses e-mail et des adresses IP indéfiniment — une
 * infraction directe au principe de limitation de la conservation, art. 5(1)(e).
 */
export const PII_RETENTION_YEARS = 3

/**
 * Silence de la boucle de retour SES au-delà duquel on alerte : des e-mails partent, aucun
 * accusé (remise, rebond, plainte) ne revient. Une rupture de cette chaîne est INVISIBLE par
 * nature — elle ressemble à « aucun problème ».
 */
export const SES_FEEDBACK_SILENCE_DAYS = 7

/**
 * États de consentement Shopify qui AUTORISENT une inscription. Liste BLANCHE, jamais une
 * liste noire : Shopify ajoutera des valeurs à cet énuméré sur un horizon de plusieurs
 * années, et une valeur inconnue ne doit jamais être lue comme « on peut y aller ».
 */
export const SUBSCRIBABLE_PRIOR_STATES = ['NOT_SUBSCRIBED', 'PENDING', 'SUBSCRIBED'] as const

// --- Limitation de débit -----------------------------------------------------------------

/** Par adresse e-mail, sur 24 h — complète le throttle par IP du middleware. */
export const MAX_SUBSCRIBES_PER_EMAIL_PER_DAY = 3
/** Par IP, sur 1 h — appliqué par le middleware `throttle`. */
export const MAX_SUBSCRIBES_PER_IP_PER_HOUR = 10

// --- Mentions ----------------------------------------------------------------------------

/**
 * Version des mentions affichées à l'inscription, journalisée avec la preuve. À incrémenter
 * quand le texte du consentement change : c'est ce qui permet, des années plus tard, de dire
 * à quoi une personne a exactement consenti.
 */
export const TERMS_VERSION = '2026-08'

/**
 * Mention postale du pied d'e-mail — DÉSORMAIS OBLIGATOIRE, et plus une option du marchand.
 *
 * L'ancien commentaire disait vrai pour une diffusion purement européenne : l'art. L34-5 du
 * CPCE se contente d'un expéditeur identifiable et d'un moyen de s'opposer, tous deux déjà
 * assurés. Mais le dispositif sert maintenant les **États-Unis** et le **Canada** :
 *
 *   • CAN-SPAM (US) exige une adresse postale physique valide dans CHAQUE message commercial ;
 *   • CASL (Canada) exige l'adresse postale de l'expéditeur, également dans chaque message.
 *
 * Ce n'est donc plus un arbitrage de goût. La valeur est ici, en dur, et non plus seulement
 * dans `NEWSLETTER_POSTAL_ADDRESS` : une obligation légale ne doit pas dépendre d'une variable
 * d'environnement qu'un redéploiement peut oublier — elle était d'ailleurs VIDE en production.
 * La variable reste prioritaire si elle est renseignée, pour pouvoir corriger sans livrer.
 */
export const POSTAL_SENDER = 'SAS KINDOPIA, 60 rue François 1er, 75008 Paris'

// --- Réassurance affichée dans les e-mails -----------------------------------------------

/**
 * Note et nombre d'avis Trustpilot, repris du thème.
 *
 * ⛔ VALEURS RÉELLES, JAMAIS MAJORÉES. Une note gonflée dans un e-mail commercial est une
 * pratique commerciale trompeuse (dir. 2005/29/CE, art. 6) — et le lecteur qui clique vérifie
 * en trois secondes.
 *
 * ⚠️ Elles ne se rafraîchissent pas toutes seules : à revoir quand le thème change les siennes.
 */
export const TRUSTPILOT_SCORE = 4.2
export const TRUSTPILOT_COUNT = 81

/**
 * Collection d'où viennent les œuvres du bloc « les plus choisies » du 2ᵉ e-mail.
 *
 * ⚠️ Une COLLECTION, et pas un tri de produits : `ProductSortKeys` de l'Admin API n'a pas de
 * `BEST_SELLING` (vérifié par introspection — il n'existe que côté Storefront), alors que
 * `ProductCollectionSortKeys` l'a. Celle-ci est entretenue par le marchand, contient 30 œuvres
 * et est déjà triée sur les ventes.
 *
 * Si elle disparaît, le bloc disparaît avec elle : c'est le comportement voulu, pas une panne.
 */
export const BEST_SELLERS_COLLECTION = 'bestsellers-1'
