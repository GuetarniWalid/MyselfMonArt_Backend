import { BaseCommand, flags } from '@adonisjs/core/build/standalone'

/**
 * Lance la rotation du code promo à la main — amorçage du dispositif et recette.
 *
 *   node ace promo:rotate                 # un tour complet (rotation + ménage)
 *   node ace promo:rotate --status        # état seul, rien n'est écrit
 *   node ace promo:rotate --skip-cleanup  # rotation seule
 *
 * Rejouable sans risque : le code de la semaine est déterministe et la semaine ISO est
 * une clé unique en base — relancer la commande ne crée jamais de remise en double.
 */
export default class PromoRotateNow extends BaseCommand {
  public static commandName = 'promo:rotate'
  public static description =
    'Publie le code promo de la semaine (remise Shopify + métachamps de boutique). Idempotent.'

  public static settings = { loadApp: true, stayAlive: false }

  @flags.boolean({ description: 'Affiche l’état courant sans rien écrire' })
  public status: boolean

  @flags.boolean({ description: 'Saute le ménage des remises expirées depuis plus de 30 jours' })
  public skipCleanup: boolean

  public async run() {
    const { default: PromoRotationService } = await import('App/Services/PromoRotation')
    const service = new PromoRotationService()

    if (this.status) {
      this.logger.info(JSON.stringify(await service.status(), null, 2))
      return
    }

    const outcome = await service.rotate()

    if (outcome.action === 'failed') {
      this.logger.error(`${outcome.isoWeek} — rien publié : ${outcome.error}`)
      this.logger.info('L’ancien code reste en place et valide (mode fail-stale).')
      this.exitCode = 1
    } else {
      const label = {
        noop: 'déjà à jour',
        created: 'remise créée et publiée',
        reused: 'remise existante publiée',
        repaired: 'métachamps réalignés',
      }[outcome.action]
      this.logger.success(
        `${outcome.isoWeek} — ${outcome.code} (${label}), valide jusqu’au ${outcome.endsAt}`
      )
    }

    if (!this.skipCleanup) {
      const done = await service.cleanup()
      this.logger.info(`Ménage : ${done} remise(s) expirée(s) désactivée(s).`)
    }
  }
}
