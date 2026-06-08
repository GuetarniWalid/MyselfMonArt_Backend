import { BaseCommand } from '@adonisjs/core/build/standalone'
import { translateMenuLinks } from 'App/Services/i18n/translateMenuLinks'
import { logTaskBoundary } from 'App/Utils/Logs'

/**
 * One-off translation of all menu link titles into every active locale. Same logic as the
 * nightly TranslateMenu task — use this to backfill immediately (e.g. right after adding
 * the menu translator) instead of waiting for the cron.
 *
 *   node ace translate:menus
 */
export default class TranslateMenus extends BaseCommand {
  public static commandName = 'translate:menus'
  public static description = 'Translate all menu link titles into every active locale'

  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  public async run() {
    logTaskBoundary(true, 'Translate menus (manual)')
    await translateMenuLinks()
    logTaskBoundary(false, 'Translate menus (manual)')
  }
}
