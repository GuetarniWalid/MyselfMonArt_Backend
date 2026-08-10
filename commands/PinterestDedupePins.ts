import { BaseCommand, flags } from '@adonisjs/core/build/standalone'
import type { PinterestPin, PinterestPinMetricValues } from 'Types/Pinterest'
import Pinterest from 'App/Services/Pinterest'
import { describeMetrics, rankByPerformance } from 'App/Services/Pinterest/PinRanking'
import SocialPublication from 'App/Models/SocialPublication'

/** Un pin candidat, avec les métriques déjà résolues. */
type ScoredPin = {
  id: string
  pin: PinterestPin
  metrics: PinterestPinMetricValues
  createdAt: number
}

/**
 * Supprime les pins en double : un même produit épinglé plusieurs fois.
 *
 * Ces doublons datent d'avant le correctif de déduplication (qui portait sur la
 * paire produit × board au lieu du produit seul). Le cron ne peut plus en créer,
 * mais ceux déjà en ligne restent visibles sur le compte.
 *
 * RÈGLE DE CONSERVATION : on garde le pin le plus performant et on supprime le
 * moins vu / le moins aimé. Départage, dans l'ordre : vues (`impression`),
 * « j'aime » (`reaction`), enregistrements (`save`), clics (`pin_click`), puis
 * le pin le plus ancien — plus établi et mieux indexé.
 *
 * La suppression est DÉFINITIVE : l'API Pinterest ne propose aucune restauration.
 * D'où la simulation par défaut, qui affiche les chiffres retenus ; `--yes` seul
 * déclenche l'action.
 *
 * Le registre `social_publications` est recalé après coup : si le pin conservé
 * n'est pas celui que la ligne référençait, on met à jour `external_id` et
 * `external_board_id` pour ne pas garder un identifiant mort.
 */
export default class PinterestDedupePins extends BaseCommand {
  public static commandName = 'pinterest:dedupe_pins'
  public static description =
    'Supprime les pins en double (même produit épinglé plusieurs fois) en gardant le plus performant. Sans --yes, simple simulation chiffrée.'

  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  @flags.boolean({
    description: 'Supprime réellement les pins perdants. SANS RETOUR POSSIBLE.',
  })
  public yes: boolean

  public async run() {
    const pinterest = new Pinterest([])
    await pinterest.initialize()

    const pins = await pinterest.fetcher.getAllPins()
    const groups = PinterestDedupePins.groupByProduct(pins)
    const duplicates = [...groups.entries()].filter(([, list]) => list.length > 1)

    this.logger.info(
      `${pins.length} pins, ${groups.size} produits distincts, ${duplicates.length} produit(s) en double.`
    )
    if (duplicates.length === 0) {
      this.logger.success('Aucun doublon à traiter.')
      return
    }

    let deleted = 0
    const failures: Array<{ id: string; reason: string }> = []

    for (const [productId, group] of duplicates) {
      // Les métriques ne figurent pas dans la liste paginée : un appel par pin.
      const scored: ScoredPin[] = []
      for (const pin of group) {
        scored.push(await this.score(pinterest, pin))
      }
      const ranked = rankByPerformance(scored)
      const keep = ranked[0]
      const losers = ranked.slice(1)

      this.logger.info(`\nProduit ${productId}`)
      for (const entry of ranked) {
        const mark = entry === keep ? 'GARDÉ   ' : 'SUPPRIMÉ'
        this.logger.info(
          `  ${mark} pin ${entry.pin.id} — ${describeMetrics(entry.metrics)} — « ${entry.pin.title} »`
        )
      }

      if (!this.yes) continue

      for (const loser of losers) {
        try {
          await pinterest.poster.deletePin(loser.pin.id)
          deleted++
        } catch (error) {
          const reason = (error as any)?.message ?? String(error)
          failures.push({ id: loser.pin.id, reason })
          this.logger.error(`  échec suppression ${loser.pin.id} : ${reason}`)
        }
      }
      await this.realignLedger(
        productId,
        keep.pin,
        losers.map((l) => l.pin.id)
      )
    }

    if (!this.yes) {
      this.logger.warning('\n[SIMULATION] Aucun pin supprimé. Relancer avec --yes pour appliquer.')
      return
    }

    this.logger.info(`\nTerminé : ${deleted} pin(s) supprimé(s), ${failures.length} en échec.`)
    for (const failure of failures) {
      this.logger.warning(`  ${failure.id} — ${failure.reason}`)
    }
  }

  /** Récupère les métriques du pin ; un pin sans métriques compte comme zéro. */
  private async score(pinterest: Pinterest, pin: PinterestPin): Promise<ScoredPin> {
    let metrics: PinterestPinMetricValues = {}
    try {
      const detailed = await pinterest.fetcher.getPin(pin.id, true)
      // `lifetime_metrics` est le bon repère ; on retombe sur la fenêtre 90 j
      // quand Pinterest ne le fournit pas.
      metrics = detailed.pin_metrics?.lifetime_metrics ?? detailed.pin_metrics?.['90d'] ?? {}
    } catch (error) {
      this.logger.warning(
        `  métriques indisponibles pour ${pin.id} (comptées à zéro) : ${(error as any)?.message ?? error}`
      )
    }
    return { id: pin.id, pin, metrics, createdAt: new Date(pin.created_at).getTime() || 0 }
  }

  /**
   * Recale le registre sur le pin conservé. Sans ça, la ligne pourrait pointer
   * vers un pin qu'on vient de supprimer.
   */
  private async realignLedger(productId: string, keptPin: PinterestPin, deletedIds: string[]) {
    const row = await SocialPublication.query()
      .where('channel', 'pinterest')
      .where('shopify_product_id', productId)
      .first()
    if (!row) return
    if (row.externalId && !deletedIds.includes(row.externalId)) return

    row.merge({
      externalId: keptPin.id,
      externalBoardId: keptPin.board_id,
      metadata: {
        ...(row.metadata ?? {}),
        title: keptPin.title,
        dedupedAt: new Date().toISOString(),
      },
    })
    await row.save()
    this.logger.info(`  registre recalé sur le pin conservé ${keptPin.id}`)
  }

  /** Regroupe les pins par produit, via le `shopify_product_id` porté par le lien. */
  private static groupByProduct(pins: PinterestPin[]): Map<string, PinterestPin[]> {
    const groups = new Map<string, PinterestPin[]>()
    for (const pin of pins) {
      const productId = PinterestDedupePins.productIdOf(pin)
      if (!productId) continue
      const list = groups.get(productId) ?? []
      list.push(pin)
      groups.set(productId, list)
    }
    return groups
  }

  private static productIdOf(pin: PinterestPin): string | null {
    try {
      const raw = new URL(pin.link).searchParams.get('shopify_product_id')
      if (!raw) return null
      const numeric = raw.replace(/\D/g, '')
      return numeric ? `gid://shopify/Product/${numeric}` : null
    } catch {
      return null
    }
  }
}
