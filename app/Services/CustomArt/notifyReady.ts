import Logger from '@ioc:Adonis/Core/Logger'
import { DateTime } from 'luxon'
import CustomArtJob from 'App/Models/CustomArtJob'
import CustomArtStorage from 'App/Services/CustomArt/Storage'
import ReadyMailer from 'App/Services/CustomArt/ReadyMailer'

/**
 * Prévient la cliente que sa création est prête — SI elle l'a demandé.
 *
 * Appelé aux TROIS endroits qui font passer un job en `ready` : les deux chemins du worker
 * (foot historique et recette générique) et la file artiste, où un rendu est attaché à la main.
 * Ce dernier compte particulièrement : la cliente y a attendu le plus longtemps.
 *
 * Idempotent par `notify_sent_at` — un job repris (orphelin relancé après un redéploiement) ne
 * réexpédie pas l'e-mail. Best-effort de bout en bout : jamais de throw, un e-mail raté ne doit
 * pas faire échouer une création par ailleurs terminée et consultable.
 */
export async function notifyReadyIfRequested(job: CustomArtJob): Promise<void> {
  try {
    if (!job.notifyEmail || job.notifySentAt) return

    const candidates = job.candidates || []
    const chosen = job.chosenIndex !== null ? candidates[job.chosenIndex] : null
    const previewUrl = chosen?.previewPath ? CustomArtStorage.publicUrl(chosen.previewPath) : null

    const sent = await new ReadyMailer().send({
      email: job.notifyEmail,
      jobUuid: job.uuid,
      locale: job.notifyLocale,
      previewUrl,
    })
    if (!sent) return

    // Horodaté APRÈS l'envoi : un échec laisse la porte ouverte à une prochaine tentative
    // (nouvelle bascule en ready), plutôt que de consommer silencieusement la notification.
    job.notifySentAt = DateTime.now()
    await job.save()
    Logger.info(
      'custom-art ready-mail envoyé uuid=%s locale=%s',
      job.uuid,
      job.notifyLocale || 'fr'
    )
  } catch (e) {
    Logger.error('custom-art ready-mail: %s', (e as any)?.message || e)
  }
}
