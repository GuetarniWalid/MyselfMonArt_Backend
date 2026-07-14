import { BaseTask, CronTimeV2 } from 'adonis5-scheduler/build/src/Scheduler/Task'
import Shopify from 'App/Services/Shopify'
import { logTaskBoundary } from 'App/Utils/Logs'
import { expectedVariantCount, finalizePosterDraft } from 'App/Services/BulkPosters/finalizePoster'

/**
 * Filet automatique des posters jumeaux/bulk restés en BROUILLON.
 *
 * Rappel du flux : publier une toile enchaîne sur son poster jumeau → un brouillon caché est créé
 * (marqueur `link.poster_draft` sur la toile), le webhook `products/create` lui copie ses 7 variantes
 * en arrière-plan, puis `finalize` le publie. Si ce webhook rate (worker recyclé, erreur Shopify
 * transitoire acquittée donc jamais re-tentée), le poster reste à 1 variante : le tout-ou-rien le garde
 * caché — correct, mais PLUS RIEN ne le termine. `finalize` seul ne recrée PAS les variantes, donc le
 * poster restait cassé en silence jusqu'à une réparation manuelle (arrivé 2× en 5 jours : 09/07 et 14/07).
 *
 * Ce cron ferme la boucle : il RESYNCHRONISE le brouillon depuis le produit-modèle (exactement ce que
 * le webhook aurait dû faire) PUIS finalise. Rien de plus.
 *
 * Gardes (un cron qui publie tout seul doit être ennuyeux) :
 *   - il ne voit QUE les brouillons désignés par `link.poster_draft` sur une toile — marqueur écrit
 *     par notre seul `createOne`. Il ne peut donc pas toucher un produit arbitraire ;
 *   - `canProcessProductCreate` est consulté sur CHAQUE poster avant toute écriture : c'est lui qui
 *     écarte les modèles, les mauvais `artwork.type` et les posters personnalisés (`poster.isCustom`) ;
 *   - il ne publie QUE via `finalizePosterDraft` (tout-ou-rien : complet ou rien) ;
 *   - il ne SUPPRIME jamais un produit (au pire il nettoie un marqueur devenu orphelin) ;
 *   - MIN_AGE : il ignore les brouillons récents pour ne JAMAIS courir contre le webhook, qui est
 *     peut-être encore en train de créer les variantes (les deux recréent les options → dégâts).
 *     Cette garde est FAIL-CLOSED : âge inconnu ⇒ on ne touche pas.
 *   - il s'arrête net sur le cap quotidien de variantes Shopify et reprend au run suivant.
 *
 * ⚠️ MIN_AGE est la SEULE barrière contre le webhook : le cron tourne dans un process PM2 distinct
 * (`npm run cron`), donc aucun verrou mémoire de l'app ne le protège. Sa validité repose sur le fait
 * que le webhook échoue vite : `Modelcopier.DAILY_LIMIT_RETRY_DELAYS = []` (plus de backoff 1 min→24 h).
 * Si ce backoff était rétabli un jour, un retry pourrait vivre au-delà de 30 min et rouvrir la course.
 */
export default class RepairPendingPosters extends BaseTask {
  // Toutes les heures : un poster cassé est réparé en ~1 h au lieu d'attendre une intervention.
  // Minute 20 pour ne pas tomber avec les tâches quotidiennes (toutes calées sur :00/:15/:30/:45).
  public static get schedule() {
    return CronTimeV2.everyHourAt(20)
  }

  // Un run peut être long (resync + publication) : jamais deux en parallèle.
  public static get useLock() {
    return true
  }

  private static readonly MAX_PER_RUN = 15

  // Le chemin NORMAL passe par un brouillon de quelques minutes (rendu → webhook → finalize).
  // On ne touche qu'au-delà : passé 30 min, un brouillon encore incomplet est une VRAIE panne,
  // et plus aucun webhook n'est en vol → zéro risque de collision.
  private static readonly MIN_AGE_MS = 30 * 60 * 1000

  public async handle() {
    logTaskBoundary(true, 'Repair pending posters')
    const shopify = new Shopify()

    try {
      const pending = await shopify.product.getPendingPosterDrafts()
      if (!pending.length) {
        console.info('🩹 No pending poster draft — nothing to do')
        return
      }

      console.info(`🩹 ${pending.length} pending poster draft(s) to inspect`)

      let published = 0
      let repaired = 0
      let cleaned = 0
      let tooYoung = 0
      let skipped = 0

      for (const p of pending.slice(0, RepairPendingPosters.MAX_PER_RUN)) {
        try {
          // Lecture AUTORITATIVE : tout ce qu'on décide (âge, variantes, orientation) vient d'ici.
          const poster = (await shopify.product.getProductById(p.posterId)) as any

          // Brouillon disparu (supprimé à la main) : on nettoie le marqueur, la toile redevient une
          // candidate normale. Aucun âge à vérifier — il n'y a plus rien avec quoi entrer en course.
          // getProductById ne renvoie null que si Shopify dit vraiment « absent » (sinon il lève).
          if (!poster) {
            await shopify.metafield.delete(p.toileId, 'link', 'poster_draft')
            cleaned++
            console.info(`🧹 Draft ${p.posterId} gone — marker cleaned on "${p.toileTitle}"`)
            continue
          }

          // Garde anti-course. FAIL-CLOSED : un âge illisible ne doit JAMAIS ouvrir la porte —
          // ce serait exactement le cas où l'on risque de doubler le webhook en vol.
          const age = this.ageOf(poster)
          if (age === null) {
            console.warn(
              `⏭️  ${p.posterId} "${p.toileTitle}": âge illisible — skipped (fail-closed)`
            )
            skipped++
            continue
          }
          if (age < RepairPendingPosters.MIN_AGE_MS) {
            tooYoung++
            continue
          }

          // Le ratio décide du modèle (donc du nb de variantes attendu). Indéterminable ⇒ on ne
          // devine PAS : se tromper de modèle publierait une grille de variantes fausse.
          const ratio = this.orientationOf(poster)
          if (!ratio) {
            console.warn(`⏭️  ${p.posterId} "${p.toileTitle}": orientation indéterminée — skipped`)
            skipped++
            continue
          }

          const expected = await expectedVariantCount(shopify, ratio)
          if (!expected) {
            console.warn(`⏭️  ${p.posterId}: modèle poster ${ratio} illisible — skipped`)
            skipped++
            continue
          }

          // Brouillons « mal formés » (création coupée par un blip), modèles, posters
          // personnalisés (poster.isCustom) : le copier refuse de les traiter. On ne force RIEN —
          // on signale (ceux-là demandent un delete + recréation manuels).
          if (!shopify.product.artworkCopier.canProcessProductCreate(poster)) {
            console.warn(
              `⏭️  ${p.posterId} "${p.toileTitle}": not processable (canProcessProductCreate=false) — needs manual delete + recreate`
            )
            skipped++
            continue
          }

          // Resync SYSTÉMATIQUE, pas seulement « s'il manque des variantes ». Compter les variantes
          // ne suffit pas : un brouillon peut en avoir 7 tout en gardant la variante par défaut à
          // 0,00 € (création interrompue APRÈS l'ajout des variantes mais AVANT le repricing) — on
          // publierait alors un poster à 0 €. Le copier est différentiel : il compare aussi les PRIX
          // et sort en « No changes detected » quand il n'y a rien à faire. Donc c'est gratuit et
          // strictement plus sûr.
          const variantsCount = poster.variants?.nodes?.length ?? 0
          console.info(
            `🔧 ${p.posterId} "${p.toileTitle}": ${variantsCount}/${expected} variants — syncing from model`
          )
          await shopify.product.artworkCopier.copyModelDataFromImageRatio(poster)
          repaired++

          // Relit l'état frais et publie SI complet (sinon le brouillon reste caché, repris au
          // prochain run). C'est la même fonction que l'endpoint HTTP : un seul tout-ou-rien.
          const result = await finalizePosterDraft(shopify, p.toileId, p.posterId, ratio)
          if (result.outcome === 'published') {
            published++
            console.info(`✅ Published "${p.toileTitle}" poster → ${result.link}`)
          } else if (result.outcome === 'pending') {
            console.warn(
              `⏳ ${p.posterId} still incomplete (${result.variantsCount}/${result.expected}) — will retry next run`
            )
          } else if (result.outcome === 'forbidden') {
            // Inatteignable par construction : le couple vient de `getPendingPosterDrafts` (= la
            // lecture de link.poster_draft, exactement ce que la garde revérifie). Si ça arrive, le
            // marqueur a bougé pendant le run (finalisé en parallèle) — on ne force rien, on trace.
            console.warn(
              `⏭️  ${p.posterId} "${p.toileTitle}": plus le brouillon de cette toile — skipped`
            )
            skipped++
          }
        } catch (error: any) {
          const msg = error instanceof Error ? error.message : String(error)

          // Cap quotidien de création de variantes Shopify : inutile d'insister aujourd'hui.
          if (msg.includes('Daily variant')) {
            console.warn(
              `🛑 Daily variant limit reached after ${repaired} sync(s). Stopping; will resume next run.`
            )
            break
          }

          console.error(`❌ Failed to repair ${p.posterId} "${p.toileTitle}": ${msg}`)
        }

        // Espacement doux entre deux produits (le cap variantes est une fenêtre glissante).
        await new Promise((resolve) => setTimeout(resolve, 2000))
      }

      console.info(
        `🩹 Pending posters run done: ${published} published, ${repaired} synced, ${cleaned} cleaned, ${tooYoung} too young, ${skipped} skipped`
      )
    } catch (error: any) {
      const msg = error instanceof Error ? error.message : String(error)
      console.error(`❌ RepairPendingPosters failed: ${msg}`)
    } finally {
      logTaskBoundary(false, 'Repair pending posters')
    }
  }

  /** Âge du produit en ms, ou null si `createdAt` est absent/illisible (⇒ l'appelant s'abstient). */
  private ageOf(product: any): number | null {
    const createdAt = product?.createdAt
    if (!createdAt) return null
    const at = new Date(createdAt).getTime()
    if (!Number.isFinite(at)) return null
    return Date.now() - at
  }

  /**
   * Orientation de l'œuvre = media[1] (media[0] = fond blanc), même convention que le copier de
   * modèle et que `candidates`. Carré → null : il n'existe pas de modèle poster carré.
   */
  private orientationOf(product: any): 'portrait' | 'landscape' | null {
    const image = product?.media?.nodes?.[1]?.image
    const width = image?.width
    const height = image?.height
    if (!width || !height || width <= 0 || height <= 0) return null
    const ratio = width / height
    if (Math.abs(ratio - 1) < 0.01) return null
    return ratio > 1 ? 'landscape' : 'portrait'
  }
}
