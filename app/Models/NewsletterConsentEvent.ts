import { DateTime } from 'luxon'
import { BaseModel, column } from '@ioc:Adonis/Lucid/Orm'

export type ConsentEventKind =
  | 'subscribe'
  | 'resubscribe'
  | 'unsubscribe'
  | 'bounce'
  | 'complaint'
  | 'redact'

/**
 * Preuve de consentement — APPEND-ONLY.
 *
 * On n'écrit ici que des faits datés. Ne jamais mettre à jour ni supprimer une ligne (la seule
 * exception est la purge RGPD, qui efface l'adresse en clair et laisse l'empreinte).
 * `consentUpdatedAt` chez Shopify est écrasé à chaque changement d'avis ; ce journal est ce
 * qui reste quand la preuve d'origine y a disparu.
 */
export default class NewsletterConsentEvent extends BaseModel {
  public static table = 'newsletter_consent_events'

  /** Ce journal n'a pas de `updated_at` : rien n'y est jamais modifié. */
  public static selfAssignPrimaryKey = false

  @column({ isPrimary: true })
  public id: number

  @column()
  public subscriberId: number | null

  /** Effacé par la purge RGPD ; l'empreinte, elle, survit. */
  @column()
  public email: string | null

  @column()
  public emailHash: string

  @column()
  public event: ConsentEventKind

  @column()
  public ip: string | null

  @column()
  public userAgent: string | null

  @column()
  public sourceUrl: string | null

  /** Le libellé RÉELLEMENT AFFICHÉ au moment du geste — un libellé reconstitué ne prouve rien. */
  @column()
  public consentLabel: string | null

  @column()
  public termsVersion: string | null

  @column()
  public locale: string | null

  @column()
  public purpose: string | null

  /**
   * État de consentement lu chez Shopify AVANT notre écriture — la trace qu'on a regardé
   * avant d'écrire, et le seul moyen de revenir en arrière si on s'est trompé.
   */
  @column()
  public priorMarketingState: string | null

  @column({ consume: (v) => (v === null || v === undefined ? null : Number(v)) })
  public occurredTs: number

  @column.dateTime()
  public occurredAt: DateTime
}
