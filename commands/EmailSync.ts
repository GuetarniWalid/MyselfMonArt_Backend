import { BaseCommand } from '@adonisjs/core/build/standalone'
import EmailIngestion from 'App/Services/EmailIngestion'

/**
 * Manual trigger for the SAV email channel ingestion. Runs ONE sync:
 * ingest new INBOX mail since the stored history cursor → triage → draft.
 * The first run only baselines the cursor (ingests nothing), so it is safe
 * to run for a smoke test. Independent of EMAIL_CHANNEL_ENABLED (explicit
 * manual action), so the channel can stay dormant for the cron/webhook.
 */
export default class EmailSync extends BaseCommand {
  public static commandName = 'email:sync'
  public static description =
    'Run one Gmail inbox sync for the SAV email channel (ingest new mail → triage → draft replies). First run only baselines the cursor.'

  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  public async run() {
    this.logger.info('Running Gmail inbox sync...')
    const res = await new EmailIngestion().sync()
    this.logger.info(`Done. Ingested ${res.ingested} new message(s).`)
  }
}
