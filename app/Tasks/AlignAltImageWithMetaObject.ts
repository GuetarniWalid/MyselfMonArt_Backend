import type { Product as ShopifyProduct } from 'Types/Product'
import { BaseTask, CronTimeV2 } from 'adonis5-scheduler/build/src/Scheduler/Task'
import Product from 'App/Services/Shopify/Product'

export default class AlignAltImageWithMetaObject extends BaseTask {
  public static get schedule() {
    return CronTimeV2.everyDayAt(3, 0)
  }

  public static get useLock() {
    return false
  }

  public async handle() {
    const product = new Product()
    const products = await product.getAll()
    const productsWithAltProblem = [] as string[]

    for (const shopifyProduct of products) {
      console.log('🚀 ~ Product title:', shopifyProduct.title)
      const mediaAltsWithEmptyAlt = await this.getMediaAlts(shopifyProduct)
      this.getProductsWithAltProblem(shopifyProduct, mediaAltsWithEmptyAlt, productsWithAltProblem)
      const mediaAlts = this.cleanMediaAlts(mediaAltsWithEmptyAlt)
      const mediaAltsFromMetaObject = this.getMediaAltsFromMetaObject(shopifyProduct)
      const areAltsEqual = this.compareArrays(mediaAlts, mediaAltsFromMetaObject)

      if (areAltsEqual) continue

      await this.updateMediaObjectWithNewAlts(product, shopifyProduct, mediaAlts)
      console.log('🚀 ~ metaobject updated')
      console.log('--------------------------------')
    }
    console.log('🚀 ~ all metaobjects updated')
    console.log('🚀 ~ products with alt problem:', productsWithAltProblem)
  }

  private getMediaAlts(product: ShopifyProduct) {
    return product.media.nodes.map((node) => node.alt)
  }

  private getMediaAltsFromMetaObject(product: ShopifyProduct) {
    const metafields = product.metafields.edges
    const mediaAltsMetaObject = metafields.filter(
      (metafield) => metafield.node.namespace === 'meta_object' && metafield.node.key === 'media'
    )
    const mediaAltsString = mediaAltsMetaObject?.[0]?.node?.reference?.field?.value as
      | string
      | undefined
    return this.stringToArray(mediaAltsString)
  }

  private cleanMediaAlts(mediaAlts: string[]) {
    return mediaAlts.map((alt) => {
      const cleanAlt = alt?.replace(/\n+/g, ' ').trim()
      if (!cleanAlt) return 'Pas de description'
      return cleanAlt
    })
  }

  private stringToArray(string: string | undefined): string[] | null {
    if (!string) return null
    return JSON.parse(string)
  }

  private compareArrays(array1: string[], array2: string[] | null) {
    if (array1.length !== array2?.length) return false
    return array1.every((value, index) => value === array2[index])
  }

  private async updateMediaObjectWithNewAlts(
    product: Product,
    shopifyProduct: ShopifyProduct,
    mediaAlts: string[]
  ) {
    const metaObjectId = await this.getMetaObjectIdFromProduct(shopifyProduct)

    if (metaObjectId) {
      await this.updateExistingMediaMetaObject(product, metaObjectId, mediaAlts)
    } else {
      await this.createAndBindMediaMetaObjectToProduct(product, shopifyProduct, mediaAlts)
    }
  }

  private getMetaObjectIdFromProduct(product: ShopifyProduct) {
    return product.metafields.edges.find(
      (metafield) => metafield.node.namespace === 'meta_object' && metafield.node.key === 'media'
    )?.node.reference?.id
  }

  private async updateExistingMediaMetaObject(
    product: Product,
    metaObjectId: string,
    mediaAlts: string[]
  ) {
    const { userErrors } = await product.updateAltTextsMetaObject(metaObjectId, mediaAlts)

    if (userErrors.length > 0) {
      console.log('🚀 ~ userErrors:', userErrors)
    }
  }

  private async createAndBindMediaMetaObjectToProduct(
    product: Product,
    shopifyProduct: ShopifyProduct,
    mediaAlts: string[]
  ) {
    const { metaobject, userErrors } = await product.createMediaMetaObject(mediaAlts)
    if (userErrors.length > 0) {
      console.log('🚀 ~ userErrors:', userErrors)
      console.log('🚀 ~ mediaAlts:', mediaAlts)
      throw new Error('Error creating alt texts meta object')
    }

    await product.update(shopifyProduct.id, {
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

  private getProductsWithAltProblem(
    shopifyProduct: ShopifyProduct,
    mediaAlts: string[],
    productsWithAltProblem: string[]
  ) {
    const hasEmptyAlt = mediaAlts.some((alt) => {
      return !alt?.trim() || alt === 'Pas de description' || alt === null || alt.includes('\n')
    })

    if (hasEmptyAlt) {
      productsWithAltProblem.push(shopifyProduct.title)
    }
  }
}
