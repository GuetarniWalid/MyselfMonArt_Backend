import { BaseTask, CronTimeV2 } from 'adonis5-scheduler/build/src/Scheduler/Task'
import BacklinksController from 'App/Controllers/Http/BacklinksController'

export default class CheckBacklink extends BaseTask {
  backlinksController: BacklinksController

  public static get schedule() {
    return CronTimeV2.everyFourSeconds()
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
    this.backlinksController = new BacklinksController()
    const backlinks = await this.fetchBacklinks()
    const result = await this.backlinksController.checkLinks({urls: backlinks})
  }

  private async fetchBacklinks() {
    const backlinks = await this.backlinksController.index()
    const urls = backlinks.map(backlink => backlink.url)
    return urls
  }
}