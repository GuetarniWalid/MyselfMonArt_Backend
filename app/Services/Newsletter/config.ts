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

export const VOUCHER_AMOUNT = '15.0'
export const VOUCHER_MIN_SUBTOTAL = '80.0'
/**
 * 14 jours, et pas 21. Le passage à 21 n'avait de sens qu'avec un e-mail portant le code
 * PUBLIC hebdomadaire, dont la rotation coupait la séquence en deux. Avec un code nominatif,
 * la validité court à partir de l'inscription de chaque personne : les trois e-mails (J0, J+3,
 * J+7) tiennent largement dans la fenêtre, avec une semaine de marge.
 */
export const VOUCHER_VALIDITY_DAYS = 14

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
 * Délai entre l'envoi RÉEL d'un e-mail et l'échéance du suivant : 3 jours après E1, 4 jours
 * après E2. Une séquence à l'heure tombe donc exactement à J+3 et J+7, comme prévu.
 *
 * ⛔ Ce sont des écarts, PAS des décalages depuis l'inscription — et c'est la différence
 * entre un rattrapage propre et une salve. Après une panne de quatre jours, des décalages
 * calculés depuis l'inscription rendraient E1, E2 et E3 « dus » en même temps : trois e-mails
 * commerciaux en quarante-cinq minutes, à tout l'arriéré d'un coup.
 *
 * Index 0 = écart après E1, index 1 = écart après E2.
 */
export const SEQUENCE_GAP_DAYS = [3, 4] as const

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
 * Garde-fou du brief §7 : on refuse d'envoyer si le bon de l'inscrit expire dans moins de
 * 72 heures. Un e-mail qui vante un bon périmé avant que la personne ait eu le temps de
 * choisir une œuvre est pire que pas d'e-mail du tout.
 */
export const MIN_HOURS_BEFORE_EXPIRY = 72

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
 * Mention postale du pied d'e-mail — VIDE PAR DÉFAUT, décision du marchand.
 *
 * Ce n'est pas une obligation légale en Europe : l'art. L34-5 du CPCE exige que l'expéditeur
 * soit identifiable et qu'un moyen de s'opposer existe, ce qu'assurent déjà le nom
 * d'expéditeur, l'adresse de contact et le lien de désabonnement.
 *
 * ⚠️ Le CAN-SPAM Act américain, lui, EXIGE une adresse postale physique dès qu'un
 * destinataire est aux États-Unis. Renseigner `NEWSLETTER_POSTAL_ADDRESS` si la séquence
 * s'ouvre un jour à ce marché.
 */
export const POSTAL_SENDER = ''
