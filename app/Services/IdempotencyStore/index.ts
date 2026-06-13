import Database from '@ioc:Adonis/Lucid/Database'
import Logger from '@ioc:Adonis/Core/Logger'

/**
 * Idempotence PARTAGÉE entre tous les workers PM2 (cluster). Remplace les Map statiques
 * en mémoire (non partagées entre process -> doublons à la publication). La réservation est
 * atomique grâce à la contrainte UNIQUE de MySQL : un seul worker peut INSÉRER une clé donnée,
 * les autres reçoivent une erreur ER_DUP_ENTRY et lisent l'état courant.
 *
 * Cycle de vie d'une clé :
 *   begin() -> 'acquired'  : à ce worker de faire le travail (ligne 'pending' créée)
 *           -> 'pending'   : un autre worker le fait déjà (ne rien relancer)
 *           -> 'done'      : résultat déjà produit (le renvoyer dédupliqué)
 *   complete(key, result)  : 'pending' -> 'done' + mémorise le résultat (dédup des re-clics)
 *   release(key)           : supprime la ligne 'pending' (échec) -> un nouvel essai peut repartir
 */

const TABLE = 'idempotency_keys'
// Au-delà, une ligne 'pending' est tenue pour ABANDONNÉE (worker mort/redémarré en plein travail)
// et peut être reprise. Doit confortablement dépasser la durée d'un traitement légitime
// (publication synchrone ~30-90 s ; arrière-plan reimage ~60-120 s).
const STALE_MS = 5 * 60 * 1000
// Fenêtre de dédup d'un résultat 'done' (un re-clic dans cette fenêtre renvoie le même produit).
const DONE_TTL_MS = 30 * 60 * 1000

const isDup = (e: any) =>
  e?.code === 'ER_DUP_ENTRY' || e?.errno === 1062 || /duplicate entry/i.test(e?.message || '')

export type BeginResult =
  | { state: 'acquired' }
  | { state: 'pending' }
  | { state: 'done'; result: any }

export default class IdempotencyStore {
  /**
   * Réserve la clé de façon atomique entre workers. Voir le cycle de vie ci-dessus.
   */
  public async begin(key: string): Promise<BeginResult> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const now = new Date()
      try {
        await Database.insertQuery()
          .table(TABLE)
          .insert({ key, status: 'pending', result: null, created_at: now, updated_at: now })
        this.sweep().catch(() => {}) // purge best-effort, jamais bloquante
        return { state: 'acquired' }
      } catch (e) {
        if (!isDup(e)) throw e
        const row: any = await Database.from(TABLE).where('key', key).first()
        if (!row) continue // course : ligne supprimée entre l'INSERT et le SELECT -> on retente
        if (row.status === 'done') return { state: 'done', result: this.parse(row.result) }
        // 'pending' : si périmée (worker probablement mort), tentative de REPRISE atomique.
        // L'UPDATE conditionnel ne peut réussir que pour UN seul worker (MySQL sérialise + relit
        // le WHERE sous verrou de ligne) -> jamais deux reprises simultanées.
        const staleBefore = new Date(Date.now() - STALE_MS)
        const claimed: any = await Database.from(TABLE)
          .where('key', key)
          .where('status', 'pending')
          .where('updated_at', '<', staleBefore)
          .update({ updated_at: now })
        const affected = Number(Array.isArray(claimed) ? claimed[0] : claimed) || 0
        if (affected > 0) return { state: 'acquired' } // on a repris la ligne périmée
        return { state: 'pending' } // en cours (fraîche), ou reprise par un autre worker
      }
    }
    return { state: 'pending' } // sécurité : on ne crée JAMAIS de doublon, on signale « en cours »
  }

  /** Marque la clé terminée et mémorise le résultat à renvoyer aux re-clics. */
  public async complete(key: string, result: any): Promise<void> {
    try {
      await Database.from(TABLE)
        .where('key', key)
        .update({ status: 'done', result: JSON.stringify(result), updated_at: new Date() })
    } catch (e) {
      Logger.error('IdempotencyStore.complete %s: %s', key, (e as Error).message)
    }
  }

  /** Libère une réservation NON terminée (échec) : supprime la ligne si encore 'pending'. */
  public async release(key: string): Promise<void> {
    try {
      await Database.from(TABLE).where('key', key).where('status', 'pending').delete()
    } catch (e) {
      Logger.error('IdempotencyStore.release %s: %s', key, (e as Error).message)
    }
  }

  private parse(result: any): any {
    if (result === null || result === undefined) return null
    if (typeof result === 'object') return result // déjà parsé (selon le driver)
    try {
      return JSON.parse(result)
    } catch {
      return null
    }
  }

  /** Purge best-effort : résultats 'done' trop vieux + lignes 'pending' orphelines très anciennes. */
  private async sweep(): Promise<void> {
    try {
      await Database.from(TABLE)
        .where('status', 'done')
        .where('updated_at', '<', new Date(Date.now() - DONE_TTL_MS))
        .delete()
      await Database.from(TABLE)
        .where('status', 'pending')
        .where('updated_at', '<', new Date(Date.now() - 4 * STALE_MS))
        .delete()
    } catch {
      // best-effort
    }
  }
}
