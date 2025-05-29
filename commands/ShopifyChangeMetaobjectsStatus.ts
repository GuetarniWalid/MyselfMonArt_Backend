import { BaseCommand } from '@adonisjs/core/build/standalone'
import Metaobject from 'App/Services/Shopify/Metaobject'

export default class ShopifyChangeMetaObjectsMediaStatus extends BaseCommand {
  public static commandName = 'shopify:change_meta_objects_media_status'
  public static description = 'Change meta objects media status'

  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  public async run() {
    try {
      const metaobjectsService = new Metaobject()
      const metaobjects = await metaobjectsService.getAll('media')

      for (const metaobject of metaobjects) {
        await metaobjectsService.updateStatus(metaobject.id, 'ACTIVE')
        this.logger.info(`Updated metaobject ${metaobject.handle} (${metaobject.type}) to ACTIVE`)
      }

      this.logger.success('Successfully updated all metaobjects to ACTIVE status')
    } catch (error) {
      this.logger.error('Error updating metaobjects:', error.message)
      throw error
    }
  }
}
