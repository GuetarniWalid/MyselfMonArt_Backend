import { BaseCommand } from '@adonisjs/core/build/standalone'

/**
 * Déclenche immédiatement UN scan de relance « création sauvegardée » (M10),
 * sans attendre le cron horaire du scheduler. Sert aux tests locaux et au
 * rattrapage manuel (ex : scheduler resté éteint pendant la fenêtre 20-28 h).
 *
 * Lancer : node ace custom_art:remind_now
 *
 * Sans danger en rejeu : le verrou reminder_sent_at garantit qu'une création
 * n'est JAMAIS relancée deux fois (et les acheteurs sont exclus du scan).
 */
export default class CustomArtRemindNow extends BaseCommand {
  public static commandName = 'custom_art:remind_now'
  public static description =
    'Scan immédiat des relances CustomArt « votre tableau vous attend » (M10)'

  public static settings = {
    loadApp: true,
  }

  public async run() {
    const { default: RemindCustomArtSaves } = await import('App/Tasks/RemindCustomArtSaves')
    const { default: Logger } = await import('@ioc:Adonis/Core/Logger')

    // La Task attend (tmpPath, logger) — le verrou fichier du scheduler n'est pas
    // utilisé ici : le claim DB conditionnel suffit à interdire le double envoi.
    const task = new RemindCustomArtSaves(this.application.tmpPath(), Logger as any)
    await task.handle()
    this.logger.success('Scan de relance terminé (détail dans les logs custom-art reminder)')
  }
}
