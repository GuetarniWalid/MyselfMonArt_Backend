/**
 * Contrat d'un transport d'envoi. Module PUR (aucune dépendance Adonis) : testable hors ligne.
 *
 * L'interface existe pour une seule raison, et elle est stratégique : le prestataire d'envoi
 * peut fermer le compte sans préavis (SES exige contractuellement moins de 0,08 % de plaintes).
 * Le jour où ça arrive, il faut pouvoir basculer en changeant des variables d'environnement,
 * pas en réécrivant le dispositif.
 */

export interface RawMessage {
  /** Enveloppe : l'adresse d'expédition (Return-Path). */
  from: string
  fromName: string
  to: string
  replyTo: string
  subject: string
  text: string
  html: string
  /**
   * En-têtes supplémentaires — c'est par ici que passent `List-Unsubscribe` et
   * `List-Unsubscribe-Post`, et c'est la RAISON D'ÊTRE de l'envoi en brut : aucune API
   * « contenu simple » ne permet de les poser.
   */
  headers: Record<string, string>
}

export interface SendResult {
  /** Identifiant du message chez le prestataire — clé de rapprochement des rebonds/plaintes. */
  messageId: string
  /** 'ses' | 'smtp' — pour diagnostiquer quand un seul des deux transports pose problème. */
  transport: string
}

export interface MailTransport {
  readonly name: string
  /** Vrai si la configuration est complète. Faux = transport ignoré, sans erreur. */
  isConfigured(): boolean
  /**
   * Envoie un message DÉJÀ construit en MIME brut. Lève en cas d'échec — l'appelant décide de
   * reporter ou d'abandonner, jamais de réessayer en boucle serrée.
   */
  sendRaw(mime: Buffer, envelope: { from: string; to: string }): Promise<SendResult>
}
