import { BaseTask, CronTimeV2 } from 'adonis5-scheduler/build/src/Scheduler/Task'
import { translateMenuLinks } from 'App/Services/i18n/translateMenuLinks'
import { logTaskBoundary } from 'App/Utils/Logs'

/**
 * Nightly translation of menu link titles (Shopify LINK resource) into every active locale.
 * Fills the gap that left custom menu titles (footer legal/help links, mega-menu, …) in
 * French on the non-FR storefronts — see the 2026-06-08 i18n audit.
 */
export default class TranslateMenu extends BaseTask {
  public static get schedule() {
    return CronTimeV2.everyDayAt(2, 45)
  }

  public static get useLock() {
    return false
  }

  public async handle() {
    logTaskBoundary(true, 'Translate menus')
    await translateMenuLinks()
    logTaskBoundary(false, 'Translate menus')
  }
}
