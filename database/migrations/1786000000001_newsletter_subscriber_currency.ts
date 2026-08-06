import BaseSchema from '@ioc:Adonis/Lucid/Schema'

/**
 * Le bon devient MULTIDEVISE, et la date annoncée cesse d'être déduite de l'instant de fin.
 *
 * Deux choses que la table ne savait pas dire, et qu'il faut désormais figer À L'ÉMISSION :
 *
 *   • LA DEVISE ET L'OFFRE ANNONCÉE. Un code à montant fixe est toujours libellé dans la devise
 *     de la boutique (`DiscountAmountInput` n'a pas de champ de devise) : on pose donc un
 *     montant EN EUROS calibré pour tomber sur la cible ronde de la devise du visiteur. Ce que
 *     le client a vu promis — « 15 $ », « 20 $ CA » — n'est alors DÉDUCTIBLE de rien : ni du
 *     montant posé (qui dépend du taux du jour), ni de la langue (un Suisse peut lire en
 *     français et payer en francs). Sans ces colonnes, E2 et E3, envoyés jusqu'à six jours plus
 *     tard, annonceraient un montant recalculé à un autre taux que celui affiché à l'inscription.
 *
 *   • LA DATE ANNONCÉE. Elle n'est PAS l'instant de fin du code : le code s'arrête à 11:59:59
 *     UTC le LENDEMAIN de la date annoncée, pour que « valable jusqu'au 13 août » reste vrai à
 *     Los Angeles comme à Helsinki. La déduire de `discount_expires_ts` marcherait aujourd'hui
 *     et se casserait au premier changement de règle. On la stocke telle qu'elle a été promise.
 *
 * Toutes nullables : les lignes créées avant cette correction n'ont rien à déclarer, et le code
 * sait retomber sur l'euro et recalculer une date annoncée (cf. `expiry.announcedDateFromEnd`).
 */
export default class extends BaseSchema {
  protected tableName = 'newsletter_subscribers'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Devise du bon, telle que le thème l'a transmise (ou déduite du pays). ⚠️ N'a AUCUN
      // rapport avec `locale` : la langue et la devise sont deux axes indépendants.
      table.string('currency', 3).notNullable().defaultTo('EUR')
      // Pays ISO 3166-1 alpha-2, conservé pour l'audit et comme repli de devise.
      table.string('country', 2).nullable()

      // L'offre ANNONCÉE, dans la devise du client — ce qu'il a lu à l'écran.
      table.decimal('voucher_amount', 10, 2).nullable()
      table.decimal('voucher_threshold', 10, 2).nullable()

      // Ce qui a réellement été posé sur le code, en euros. Pour l'audit : c'est la seule trace
      // du taux appliqué le jour de l'émission.
      table.decimal('voucher_amount_eur', 10, 2).nullable()
      table.decimal('voucher_threshold_eur', 10, 2).nullable()

      // Date ANNONCÉE, `YYYY-MM-DD` en Europe/Paris. Une chaîne et non une date : une DATE
      // MySQL se fait réinterpréter par le fuseau de session puis par celui du process Node,
      // et c'est exactement le décalage silencieux d'un jour que cette correction supprime.
      table.string('discount_announced_date', 10).nullable()
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('currency')
      table.dropColumn('country')
      table.dropColumn('voucher_amount')
      table.dropColumn('voucher_threshold')
      table.dropColumn('voucher_amount_eur')
      table.dropColumn('voucher_threshold_eur')
      table.dropColumn('discount_announced_date')
    })
  }
}
