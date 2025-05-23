import { BaseTask, CronTimeV2 } from 'adonis5-scheduler/build/src/Scheduler/Task'
import BacklinksController from 'App/Controllers/Http/BacklinksController'
import { logTaskBoundary } from 'App/Utils/Logs'

export default class CheckBacklink extends BaseTask {
  private backlinksController: BacklinksController

  public static get schedule() {
    return CronTimeV2.everyDay()
    // or just use return cron-style string (simple cron editor: crontab.guru)
  }
  /**
   * Set enable use .lock file for block run retry task
   * Lock file save to `build/tmp/adonis5-scheduler/locks/your-class-name`
   */
  public static get useLock() {
    return false
  }

  public async handle() {
    logTaskBoundary(true, 'Check backlinks')

    this.backlinksController = new BacklinksController()
    const backlinks = await this.fetchBacklinks()
    // @ts-ignore
    await this.backlinksController.checkLinks({ urls: backlinks })

    logTaskBoundary(false, 'Check backlinks')
  }

  private async fetchBacklinks() {
    const backlinks = await this.backlinksController.index()
    const urls = backlinks.map((backlink) => backlink.url)
    return urls
  }
}
