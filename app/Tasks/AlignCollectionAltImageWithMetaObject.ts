import type { Collection as ShopifyCollection } from 'Types/Collection'
import { BaseTask, CronTimeV2 } from 'adonis5-scheduler/build/src/Scheduler/Task'
import Collection from 'App/Services/Shopify/Collection'

export default class AlignCollectionAltImageWithMetaObject extends BaseTask {
  public static get schedule() {
    return CronTimeV2.everyDayAt(2, 10)
  }

  public static get useLock() {
    return false
  }

  public async handle() {
    const collection = new Collection()
    const collections = await collection.getAll()
    const collectionsWithAltProblem = [] as string[]

    for (const shopifyCollection of collections) {
      const imageAlt = await this.getImageAlt(shopifyCollection)
      this.getCollectionsWithAltProblem(shopifyCollection, imageAlt, collectionsWithAltProblem)
      const imageAltCleaned = this.cleanImageAlt(imageAlt)
      const imageAltFromMetaObject = this.getImageAltFromMetaObject(shopifyCollection)
      const areAltsEqual = this.compareImageAlts(imageAltCleaned, imageAltFromMetaObject)

      if (areAltsEqual) continue
      console.log('=====================')
      console.log('🚀 ~ Id collection to align alt texts:', shopifyCollection.id)

      await this.updateMediaObjectWithNewAlts(collection, shopifyCollection, imageAltCleaned)
      console.log('🚀 ~ metaobject updated')
      console.log('=====================')
    }
    console.log('🚀 ~ all metaobjects updated')
    console.log('🚀 ~ collections with alt problem:', collectionsWithAltProblem)
  }

  private getImageAlt(collection: ShopifyCollection) {
    return collection.image?.altText
  }

  private getImageAltFromMetaObject(collection: ShopifyCollection): string | undefined {
    const metafields = collection.metafields.edges
    const imageAltMetaObject = metafields.filter(
      (metafield) => metafield.node.namespace === 'meta_object' && metafield.node.key === 'media'
    )
    const imageAlts = imageAltMetaObject?.[0]?.node?.reference?.field?.jsonValue as
      | string[]
      | undefined

    return imageAlts?.[0]
  }

  private cleanImageAlt(imageAlt: string | null) {
    const cleanAlt = imageAlt?.replace(/\n+/g, ' ').trim()
    if (!cleanAlt) return 'Pas de description'
    return cleanAlt
  }

  private compareImageAlts(alt1: string | undefined, alt2: string | undefined) {
    return alt1 === alt2
  }

  private async updateMediaObjectWithNewAlts(
    collection: Collection,
    shopifyCollection: ShopifyCollection,
    imageAlt: string | null
  ) {
    const metaObjectId = await this.getMetaObjectIdFromCollection(shopifyCollection)

    if (metaObjectId) {
      await this.updateExistingMediaMetaObject(collection, metaObjectId, imageAlt)
    } else {
      await this.createAndBindMediaMetaObjectToCollection(collection, shopifyCollection, imageAlt)
    }
  }

  private getMetaObjectIdFromCollection(collection: ShopifyCollection) {
    return collection.metafields.edges.find(
      (metafield) =>
        metafield.node.namespace === 'meta_object' && metafield.node.key === 'image_alt'
    )?.node.reference?.id
  }

  private async updateExistingMediaMetaObject(
    collection: Collection,
    metaObjectId: string,
    imageAlt: string | null
  ) {
    if (!imageAlt) {
      console.log('🚀 ~ updateExistingMediaMetaObject => imageAlt is null')
      return
    }
    const { userErrors } = await collection.updateAltTextsMetaObject(metaObjectId, [imageAlt])

    if (userErrors.length > 0) {
      console.log('🚀 ~ userErrors:', userErrors)
    }
  }

  private async createAndBindMediaMetaObjectToCollection(
    collection: Collection,
    shopifyCollection: ShopifyCollection,
    imageAlt: string | null
  ) {
    if (!imageAlt) {
      console.log('🚀 ~ createAndBindMediaMetaObjectToCollection => imageAlt is null')
      return
    }
    const { metaobject, userErrors } = await collection.createMediaMetaObject([imageAlt])
    if (userErrors.length > 0) {
      console.log('🚀 ~ userErrors:', userErrors)
      console.log('🚀 ~ imageAlt:', imageAlt)
      throw new Error('Error creating alt texts meta object')
    }

    await collection.update(shopifyCollection.id, {
      metafields: [
        {
          namespace: 'meta_object',
          key: 'media',
          type: 'metaobject_reference',
          value: metaobject.id,
        },
      ],
    })
  }

  private getCollectionsWithAltProblem(
    shopifyCollection: ShopifyCollection,
    imageAlt: string | null,
    collectionsWithAltProblem: string[]
  ) {
    const hasEmptyAlt =
      imageAlt === 'Pas de description' ||
      imageAlt === '' ||
      imageAlt === null ||
      imageAlt === undefined ||
      imageAlt.includes('\n')

    if (hasEmptyAlt) {
      collectionsWithAltProblem.push(shopifyCollection.title)
    }
  }
}
