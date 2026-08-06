import Logger from '@ioc:Adonis/Core/Logger'
import { BaseTask, CronTimeV2 } from 'adonis5-scheduler/build/src/Scheduler/Task'
import NewsletterSequence from 'App/Services/Newsletter/Sequence'
import SqsFeedback from 'App/Services/Newsletter/SqsFeedback'

/**
 * Séquence du bon de 15 € — E1 immédiat, E2 à J+3, E3 à J+7.
 *
 * Un passage toutes les 15 minutes suffit largement à ce volume (~120 envois/semaine) : la
 * précision utile est de l'ordre de l'heure, pas de la minute. Le verrou empêche deux
 * passages de se chevaucher — et même s'il tombait, la contrainte
 * `UNIQUE(subscriber_id, email_no)` interdit tout doublon.
 *
 * `run()` ne lève jamais : un inscrit en erreur n'interrompt pas les autres, et le scheduler
 * survit à tout. Tourne dans le process `cron` de PM2, séparé du serveur web.
 */
export default class RunNewsletterSequence extends BaseTask {
  public static get schedule() {
    return CronTimeV2.everyFifteenMinutes()
  }

  public static get useLock() {
    return true
  }

  public async handle() {
    // ⛔ LES RETOURS D'ABORD, LES ENVOIS ENSUITE. L'ordre n'est pas indifférent : un rebond
    // ou une plainte arrivé depuis le dernier passage doit avoir écarté l'adresse AVANT
    // qu'on décide d'écrire à quelqu'un. Dans l'autre sens, on enverrait E2 à une adresse
    // dont on vient d'apprendre qu'elle est morte.
    try {
      await new SqsFeedback().poll()
    } catch (error) {
      // Jamais bloquant : la séquence doit tourner même si la boucle de retour est en panne.
      // C'est la sonde de santé quotidienne qui alerte sur un silence prolongé.
      Logger.error(
        'newsletter: lecture des retours SES en échec — %s',
        (error as any)?.message ?? error
      )
    }

    await new NewsletterSequence().run()
  }
}
