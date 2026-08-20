import { BaseTask, CronTimeV2 } from 'adonis5-scheduler/build/src/Scheduler/Task'
import Logger from '@ioc:Adonis/Core/Logger'
import { DateTime } from 'luxon'
import CustomArtJob from 'App/Models/CustomArtJob'
import CustomArtOrder from 'App/Models/CustomArtOrder'
import CustomArtStorage from 'App/Services/CustomArt/Storage'
import { purgeJobFiles } from 'App/Services/CustomArt/jobPurge'

// Politique de rétention RGPD (plan §3/§10) : les photos clients (souvent des mineurs)
// ne restent jamais plus longtemps que nécessaire.
const UNPURCHASED_RETENTION_DAYS = 30 // jobs non achetés : tout est purgé à J+30
const SHIPPED_PHOTO_RETENTION_DAYS = 60 // commandes livrées : photo source purgée à J+60 (fichier print conservé)

/**
 * Purge quotidienne CustomArt. Tourne via `node ace scheduler:run` (process séparé
 * du serveur web — PM2/ecosystem en prod, comme les autres Tasks).
 */
export default class PurgeCustomArt extends BaseTask {
  public static get schedule() {
    return CronTimeV2.everyDayAt(4, 30)
  }

  public static get useLock() {
    return true
  }

  public async handle() {
    await this.purgeUnpurchasedJobs()
    await this.purgeShippedSourcePhotos()
  }

  /** Jobs non achetés à J+30 : fichiers supprimés (photo, candidats, previews), statut expired. */
  private async purgeUnpurchasedJobs(): Promise<void> {
    const cutoff = DateTime.now()
      .minus({ days: UNPURCHASED_RETENTION_DAYS })
      .toSQL({ includeOffset: false }) as string

    const jobs = await CustomArtJob.query()
      .whereNot('status', 'expired')
      .where('created_at', '<', cutoff)

    let purged = 0
    for (const job of jobs) {
      const hasOrder = await CustomArtOrder.query().where('job_id', job.id).first()
      if (hasOrder) continue // les jobs achetés relèvent de l'autre règle

      await purgeJobFiles(job)
      purged++
    }

    Logger.info(
      'custom-art purge: %s job(s) non acheté(s) expirés (J+%s)',
      purged,
      UNPURCHASED_RETENTION_DAYS
    )
  }

  /** Commandes livrées : la photo source est purgée à J+60 (le fichier print est conservé). */
  private async purgeShippedSourcePhotos(): Promise<void> {
    const cutoff = DateTime.now()
      .minus({ days: SHIPPED_PHOTO_RETENTION_DAYS })
      .toSQL({ includeOffset: false }) as string

    const orders = await CustomArtOrder.query()
      .where('print_status', 'shipped')
      .where('updated_at', '<', cutoff)

    let purged = 0
    for (const order of orders) {
      const job = await CustomArtJob.find(order.jobId)
      if (!job || !job.photoPath) continue

      await CustomArtStorage.delete(job.photoPath)
      job.photoPath = ''
      await job.save()
      purged++
    }

    Logger.info(
      'custom-art purge: %s photo(s) source de commandes livrées supprimées (J+%s)',
      purged,
      SHIPPED_PHOTO_RETENTION_DAYS
    )
  }
}
