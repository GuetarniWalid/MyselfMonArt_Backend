import { BaseTask, CronTimeV2 } from 'adonis5-scheduler/build/src/Scheduler/Task'
import PromoRotationService from 'App/Services/PromoRotation'

/**
 * Rotation automatique du code promo de l'encart produit.
 *
 * Passage QUOTIDIEN alors que la rotation est HEBDOMADAIRE, et c'est volontaire : la
 * semaine ISO est la clé d'idempotence, un passage sur une semaine déjà publiée ne fait
 * rien. Le nouveau code apparaît donc le lundi, et les six autres jours servent de
 * RATTRAPAGE gratuit — une panne d'API un lundi matin se répare toute seule le mardi, sans
 * que personne ne l'ait vue.
 *
 * 05:15 : créneau libre après les crons de traduction (01:30 → 04:45) et la purge de 04:30.
 *
 * Tourne via `node ace scheduler:run` (process `cron` de PM2, séparé du serveur web).
 */
export default class RotatePromoCode extends BaseTask {
  public static get schedule() {
    return CronTimeV2.everyDayAt(5, 15)
  }

  public static get useLock() {
    return true
  }

  public async handle() {
    const service = new PromoRotationService()

    // La rotation d'abord : c'est elle qui compte. Le ménage n'est que cosmétique et ne
    // doit jamais lui passer devant ni la faire échouer.
    await service.rotate()
    await service.cleanup()
  }
}
