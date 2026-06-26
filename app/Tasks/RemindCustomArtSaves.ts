import { BaseTask } from 'adonis5-scheduler/build/src/Scheduler/Task'
import Database from '@ioc:Adonis/Lucid/Database'
import Logger from '@ioc:Adonis/Core/Logger'
import { DateTime } from 'luxon'
import CustomArtJob from 'App/Models/CustomArtJob'
import CustomArtOrder from 'App/Models/CustomArtOrder'
import CustomArtSession from 'App/Models/CustomArtSession'
import CustomArtStorage from 'App/Services/CustomArt/Storage'
import ReminderMailer from 'App/Services/CustomArt/ReminderMailer'
import { affectedRows } from 'App/Services/CustomArt/db'

// Fenêtre de relance (M10) : créations sauvegardées il y a 20 à 28 h. Le scan est
// horaire et la fenêtre large de 8 h : chaque création éligible est forcément vue
// au moins une fois, et le verrou reminder_sent_at garantit UN seul envoi.
const REMINDER_MIN_AGE_H = 20
const REMINDER_MAX_AGE_H = 28

// Plafond anti-rafale : AU PLUS un rappel par session toutes les 24 h. La fenêtre
// d'éligibilité (8 h) glisse d'1 h par scan, donc deux créations d'une même session
// espacées de plus de 8 h n'entrent jamais dans la même fenêtre — sans ce plafond,
// chacune déclenchait son propre email au fil des scans horaires (rafales constatées :
// une session a reçu 4 mails dans la même matinée).
const REMINDER_COOLDOWN_H = 24

/**
 * Relance « création sauvegardée » (M10). Toutes les heures, scanne les jobs `ready`
 * dont la session a laissé un email, non achetés (aucun CustomArtOrder), créés il y a
 * 20-28 h et jamais relancés -> email chaleureux « votre tableau vous attend »
 * (aperçu + lien de reprise + rappel fête des pères quand elle approche).
 *
 * Garanties anti-spam :
 *   - UN seul rappel par création : claim conditionnel WHERE reminder_sent_at IS NULL
 *     (sûr même si plusieurs schedulers tournaient) ; le flag n'est rendu (et l'envoi
 *     retenté à l'heure suivante) que si Resend échoue, tant que la fenêtre est ouverte.
 *   - AU PLUS UN email par session toutes les 24 h (REMINDER_COOLDOWN_H) : on saute
 *     toute session déjà relancée avec succès dans les dernières 24 h. C'est ce qui
 *     évite les rafales quand les créations d'une session sont étalées sur plus de 8 h
 *     (donc jamais dans la même fenêtre de scan). Un job marqué reminder_sent_at = un
 *     envoi réussi (le rollback remet à NULL en cas d'échec), d'où un signal fiable.
 *   - UN seul email par session et par scan : si une session a plusieurs créations
 *     éligibles dans la même fenêtre, on relance sur la plus récente et on marque les autres.
 *   - Jamais de relance vers quelqu'un qui a déjà acheté (sur n'importe quel job de
 *     sa session) : l'email « votre tableau vous attend » serait absurde après achat.
 *
 * Tourne via `node ace scheduler:run` (process séparé du serveur web, comme PurgeCustomArt).
 */
export default class RemindCustomArtSaves extends BaseTask {
  public static get schedule() {
    return '5 * * * *' // toutes les heures, à la minute 5
  }

  public static get useLock() {
    return true
  }

  public async handle() {
    const windowStart = DateTime.now()
      .minus({ hours: REMINDER_MAX_AGE_H })
      .toSQL({ includeOffset: false }) as string
    const windowEnd = DateTime.now()
      .minus({ hours: REMINDER_MIN_AGE_H })
      .toSQL({ includeOffset: false }) as string

    // 1) Créations candidates : prêtes, jamais relancées, dans la fenêtre 20-28 h
    const jobs = await CustomArtJob.query()
      .where('status', 'ready')
      .whereNull('reminder_sent_at')
      .where('created_at', '>=', windowStart)
      .where('created_at', '<', windowEnd)
      .orderBy('id', 'asc')
    if (jobs.length === 0) return

    // 2) Sessions avec email uniquement (les anonymes n'ont rien laissé à relancer)
    const sessionIds = [...new Set(jobs.map((j) => j.sessionId))]
    const sessions = await CustomArtSession.query().whereIn('id', sessionIds).whereNotNull('email')
    const sessionById = new Map(sessions.map((s) => [s.id, s]))

    // 3) Exclusion des acheteurs : toute session ayant déjà une commande (sur
    // n'importe lequel de ses jobs) ne reçoit jamais ce rappel.
    const buyerRows = await CustomArtOrder.query()
      .join('custom_art_jobs', 'custom_art_jobs.id', 'custom_art_orders.job_id')
      .whereIn('custom_art_jobs.session_id', sessionIds)
      .select('custom_art_jobs.session_id as sessionId')
    const buyerSessionIds = new Set(buyerRows.map((r) => Number(r.$extras.sessionId)))

    // 3 bis) Plafond 1 rappel / session / 24 h : sessions déjà relancées avec succès dans
    // la fenêtre de cooldown. reminder_sent_at non NULL == envoi réussi (rollback à NULL
    // sinon), donc signal fiable même pour les jobs « frères » marqués sans envoi propre.
    const cooldownStart = DateTime.now()
      .minus({ hours: REMINDER_COOLDOWN_H })
      .toSQL({ includeOffset: false }) as string
    const recentRows = await Database.from('custom_art_jobs')
      .whereIn('session_id', sessionIds)
      .whereNotNull('reminder_sent_at')
      .where('reminder_sent_at', '>=', cooldownStart)
      .distinct('session_id')
    const cooledDownSessionIds = new Set(recentRows.map((r) => Number(r.session_id)))

    // 4) Un envoi par session : créations éligibles groupées, rappel sur la plus récente
    const bySession = new Map<number, CustomArtJob[]>()
    for (const job of jobs) {
      const session = sessionById.get(job.sessionId)
      if (!session || !session.email) continue
      if (buyerSessionIds.has(job.sessionId)) continue
      if (cooledDownSessionIds.has(job.sessionId)) continue // plafond 1 rappel / 24 h
      bySession.set(job.sessionId, [...(bySession.get(job.sessionId) || []), job])
    }

    let sent = 0
    for (const [sessionId, sessionJobs] of bySession) {
      const session = sessionById.get(sessionId)!
      const newest = sessionJobs[sessionJobs.length - 1]
      const jobIds = sessionJobs.map((j) => j.id)

      // Claim atomique AVANT l'envoi (un seul rappel par création, jamais plus) :
      // tous les jobs éligibles de la session sont marqués d'un coup — pas de rafale
      // d'emails quasi identiques au scan suivant pour les créations sœurs.
      const claimed = affectedRows(
        await Database.from('custom_art_jobs')
          .whereIn('id', jobIds)
          .whereNull('reminder_sent_at')
          .update({ reminder_sent_at: new Date(), updated_at: new Date() })
      )
      if (claimed === 0) continue // déjà traité par un autre passage

      const candidates = newest.candidates || []
      const chosen = newest.chosenIndex !== null ? candidates[newest.chosenIndex] : null
      const ok = await new ReminderMailer().send({
        email: session.email!,
        jobUuid: newest.uuid,
        previewUrl: chosen ? CustomArtStorage.publicUrl(chosen.previewPath) : null,
        playerName: newest.playerName,
      })

      if (ok) {
        sent++
      } else {
        // Échec d'envoi (Resend down, clé absente…) : on rend le verrou pour que le
        // scan suivant retente, tant que la fenêtre 20-28 h n'est pas refermée.
        await Database.from('custom_art_jobs')
          .whereIn('id', jobIds)
          .update({ reminder_sent_at: null, updated_at: new Date() })
      }
    }

    Logger.info(
      'custom-art reminder: %s rappel(s) envoyé(s) (%s création(s) éligibles, fenêtre %s-%s h)',
      sent,
      jobs.length,
      REMINDER_MIN_AGE_H,
      REMINDER_MAX_AGE_H
    )
  }
}
