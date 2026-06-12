import BaseSchema from '@ioc:Adonis/Lucid/Schema'

/**
 * Métadonnées de commande pour la file print admin (M9) :
 * - order_name : numéro lisible Shopify (« #1832 ») affiché dans la file et les emails ;
 * - customer_email : destinataire des emails transactionnels (confirmation, « part en
 *   production ») — capturé au webhook orders/paid pour ne pas dépendre d'une lecture
 *   Shopify au moment de l'approbation ;
 * - print_error : dernière erreur de préparation du fichier print (upscale/redimension),
 *   affichée dans la file à côté du bouton « Régénérer l'upscale ».
 */
export default class extends BaseSchema {
  protected tableName = 'custom_art_orders'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('order_name', 32).nullable().after('shopify_order_id')
      table.string('customer_email', 255).nullable().after('line_item_id')
      table.text('print_error').nullable().after('print_status')
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('order_name')
      table.dropColumn('customer_email')
      table.dropColumn('print_error')
    })
  }
}
