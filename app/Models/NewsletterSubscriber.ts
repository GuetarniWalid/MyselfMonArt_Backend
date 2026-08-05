import { DateTime } from 'luxon'
import { BaseModel, column } from '@ioc:Adonis/Lucid/Orm'

/** Le seul état qui autorise un envoi. */
export type SubscriberStatus =
  | 'active'
  | 'unsubscribed'
  | 'bounced'
  | 'complained'
  | 'converted'
  | 'redacted'

/**
 * Un BIGINT peut revenir en CHAÎNE selon la configuration du driver MySQL, et
 * `DateTime.fromSeconds('1790812799')` produit alors une date INVALIDE en silence — le projet
 * s'est déjà fait avoir sur `promo_rotations.ends_ts`. On force donc le nombre à la lecture,
 * partout où un entier epoch décide d'une action.
 */
const asNumber = (value: any) => (value === null || value === undefined ? null : Number(value))

export default class NewsletterSubscriber extends BaseModel {
  public static table = 'newsletter_subscribers'

  @column({ isPrimary: true })
  public id: number

  /**
   * Adresse normalisée (minuscules + trim) — UNIQUE, c'est la garde d'idempotence.
   * `null` après un effacement RGPD : la ligne, son empreinte et son historique d'envoi
   * survivent, l'adresse non.
   */
  @column()
  public email: string | null

  /** SHA-256(sel + adresse) : sert à reconnaître la personne après une purge RGPD. */
  @column()
  public emailHash: string

  /** Langue AFFICHÉE à l'inscription. C'est elle qui fait foi à l'envoi, pas `Customer.locale`. */
  @column()
  public locale: string

  /**
   * ⛔ Marqueur de FINALITÉ. Les ~750 abonnés dormants de la boutique n'ont pas de ligne ici :
   * ils sont structurellement hors d'atteinte, et non protégés par un filtre qu'on oublierait.
   */
  @column()
  public purpose: string

  @column()
  public shopifyCustomerId: string | null

  @column()
  public status: SubscriberStatus

  @column()
  public discountCode: string | null

  @column()
  public discountGid: string | null

  @column({ consume: asNumber })
  public discountExpiresTs: number | null

  /** Renseigné dès que Shopify signale le code consommé — LE signal de conversion. */
  @column({ consume: asNumber })
  public codeConsumedTs: number | null

  /** Départ de la séquence — pour le TEXTE des e-mails et le journal, jamais pour décider. */
  @column({ consume: asNumber })
  public sequenceStartedTs: number

  /** Prochain e-mail attendu (1|2|3), `null` quand la séquence est close. */
  @column()
  public nextEmail: number | null

  /**
   * Échéance du prochain e-mail. RÉANCRÉE sur l'envoi réel du précédent, jamais recalculée
   * depuis l'inscription : c'est ce qui empêche un rattrapage d'après-panne d'expédier E1, E2
   * et E3 à la même personne en quarante-cinq minutes.
   */
  @column({ consume: asNumber })
  public nextEmailDueTs: number | null

  /** Vrai dès que la séquence est finie OU arrêtée : borne le balayage du cron. */
  @column()
  public sequenceDone: boolean

  @column()
  public sequenceStopReason: string | null

  /** HMAC-SHA256(clé serveur, id) en base64url — recherché par index, jamais recalculé. */
  @column()
  public unsubToken: string

  @column({ consume: asNumber })
  public unsubscribedTs: number | null

  @column({ consume: asNumber })
  public bouncedTs: number | null

  @column({ consume: asNumber })
  public complainedTs: number | null

  @column()
  public shopifySyncPending: boolean

  @column()
  public shopifySyncAttempts: number

  @column()
  public shopifySyncError: string | null

  @column.dateTime()
  public shopifySyncedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime
}
