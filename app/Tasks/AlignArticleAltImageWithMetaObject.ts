import type { Article as ShopifyArticle } from 'Types/Article'
import { BaseTask, CronTimeV2 } from 'adonis5-scheduler/build/src/Scheduler/Task'
import Article from 'App/Services/Shopify/Article'

export default class AlignArticleAltImageWithMetaObject extends BaseTask {
  public static get schedule() {
    return CronTimeV2.everyDayAt(2, 0)
  }

  public static get useLock() {
    return false
  }

  public async handle() {
    const article = new Article()
    const articles = await article.getAll()
    const articlesWithAltProblem = [] as string[]

    for (const shopifyArticle of articles) {
      const imageAlt = await this.getImageAlt(shopifyArticle)
      this.getArticlesWithAltProblem(shopifyArticle, imageAlt, articlesWithAltProblem)
      const imageAltCleaned = this.cleanImageAlt(imageAlt)
      const imageAltFromMetaObject = this.getImageAltFromMetaObject(shopifyArticle)
      const areAltsEqual = this.compareImageAlts(imageAltCleaned, imageAltFromMetaObject)

      if (areAltsEqual) continue
      console.log('=====================')
      console.log('🚀 ~ Id article to align alt texts:', shopifyArticle.id)

      await this.updateMediaObjectWithNewAlts(article, shopifyArticle, imageAltCleaned)
      console.log('🚀 ~ metaobject updated')
      console.log('=====================')
    }
    console.log('🚀 ~ all metaobjects updated')
    console.log('🚀 ~ articles with alt problem:', articlesWithAltProblem)
  }

  private getImageAlt(article: ShopifyArticle) {
    return article.image?.altText
  }

  private getImageAltFromMetaObject(article: ShopifyArticle): string | undefined {
    const metafields = article.metafields.edges
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
    article: Article,
    shopifyArticle: ShopifyArticle,
    imageAlt: string | null
  ) {
    const metaObjectId = await this.getMetaObjectIdFromArticle(shopifyArticle)

    if (metaObjectId) {
      await this.updateExistingMediaMetaObject(article, metaObjectId, imageAlt)
    } else {
      await this.createAndBindMediaMetaObjectToArticle(article, shopifyArticle, imageAlt)
    }
  }

  private getMetaObjectIdFromArticle(article: ShopifyArticle) {
    return article.metafields.edges.find(
      (metafield) =>
        metafield.node.namespace === 'meta_object' && metafield.node.key === 'image_alt'
    )?.node.reference?.id
  }

  private async updateExistingMediaMetaObject(
    article: Article,
    metaObjectId: string,
    imageAlt: string | null
  ) {
    if (!imageAlt) {
      console.log('🚀 ~ updateExistingMediaMetaObject => imageAlt is null')
      return
    }
    const { userErrors } = await article.updateAltTextsMetaObject(metaObjectId, [imageAlt])

    if (userErrors.length > 0) {
      console.log('🚀 ~ userErrors:', userErrors)
    }
  }

  private async createAndBindMediaMetaObjectToArticle(
    article: Article,
    shopifyArticle: ShopifyArticle,
    imageAlt: string | null
  ) {
    if (!imageAlt) {
      console.log('🚀 ~ createAndBindMediaMetaObjectToArticle => imageAlt is null')
      return
    }
    const { metaobject, userErrors } = await article.createMediaMetaObject([imageAlt])
    if (userErrors.length > 0) {
      console.log('🚀 ~ userErrors:', userErrors)
      console.log('🚀 ~ imageAlt:', imageAlt)
      throw new Error('Error creating alt texts meta object')
    }

    await article.update(shopifyArticle.id, {
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

  private getArticlesWithAltProblem(
    shopifyArticle: ShopifyArticle,
    imageAlt: string | null,
    articlesWithAltProblem: string[]
  ) {
    const hasEmptyAlt =
      imageAlt === 'Pas de description' ||
      imageAlt === '' ||
      imageAlt === null ||
      imageAlt === undefined ||
      imageAlt.includes('\n')

    if (hasEmptyAlt) {
      articlesWithAltProblem.push(shopifyArticle.title)
    }
  }
}
