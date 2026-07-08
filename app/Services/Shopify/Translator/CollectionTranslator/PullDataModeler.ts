import type { CollectionWithOutdatedTranslations } from 'Types/Collection'
import type { LanguageCode, MetaobjectTranslation } from 'Types/Translation'
import DefaultPullDataModeler from '../PullDataModeler'

export default class PullDataModeler extends DefaultPullDataModeler {
  public async getResourceOutdatedTranslations(locale: LanguageCode = 'en') {
    const collectionToTranslate = [] as any[]
    let cursor: string | null = null
    let hasNextPage = true

    while (hasNextPage) {
      // Get collections with outdated translations without metaobject translations
      const { query, variables } = this.getCollectionsWithOutdatedTranslationsQuery(cursor, locale)
      const collectionsData = await this.fetchGraphQL(query, variables)
      const collections = collectionsData.collections.edges as {
        node: CollectionWithOutdatedTranslations
        cursor: string
      }[]

      for (const collection of collections) {
        // Check if alt media is outdated
        const isAltMediaOutdated = (await this.isAltMediaOutdated(
          collection.node.altTextsMetaObject?.reference?.id,
          locale
        )) as boolean

        // The intro/guide/faq texts live in `custom.*` metafields, which Shopify treats
        // as separate translatable resources. Check each one's translation state for this locale.
        const isIntroOutdated = await this.isMetafieldValueOutdated(
          collection.node.introMetafield?.id,
          locale
        )
        const isGuideOutdated = await this.isMetafieldValueOutdated(
          collection.node.guideMetafield?.id,
          locale
        )
        const isFaqOutdated = await this.isMetafieldValueOutdated(
          collection.node.faqMetafield?.id,
          locale
        )
        const isCoconOutdated = await this.isMetafieldValueOutdated(
          collection.node.coconMetafield?.id,
          locale
        )

        const collectionWithOnlyKeyToTranslate = this.getCollectionWithOnlyKeyToTranslate(
          collection.node,
          isAltMediaOutdated,
          isIntroOutdated,
          isGuideOutdated,
          isFaqOutdated,
          isCoconOutdated
        )
        if (collectionWithOnlyKeyToTranslate) {
          collectionToTranslate.push(collectionWithOnlyKeyToTranslate)
        }
      }

      hasNextPage = collectionsData.collections.pageInfo.hasNextPage
      if (hasNextPage) {
        cursor = collections[collections.length - 1].cursor
      }
    }

    return collectionToTranslate
  }

  private getCollectionsWithOutdatedTranslationsQuery(
    cursor: string | null = null,
    locale: LanguageCode = 'en'
  ) {
    return {
      query: `query AllCollections($cursor: String) {
                collections(first: 250, after: $cursor, query: "published_status:published") {
                  edges {
                    node {
                      id
                      title
                      descriptionHtml
                      handle
                      introMetafield: metafield(namespace: "custom", key: "intro") {
                        id
                        value
                      }
                      guideMetafield: metafield(namespace: "custom", key: "guide") {
                        id
                        value
                      }
                      faqMetafield: metafield(namespace: "custom", key: "faq") {
                        id
                        value
                      }
                      coconMetafield: metafield(namespace: "custom", key: "cocon_links") {
                        id
                        value
                      }
                      image {
                        id
                        altText
                      }
                      altTextsMetaObject: metafield(namespace: "meta_object", key: "media") {
                        reference {
                          ... on Metaobject {
                            id
                            field(key: "alts") {
                              jsonValue
                            }
                          }
                        }
                      }
                      seo {
                        title
                        description
                      }
                      translations(locale: "${locale}") {
                        key
                        locale
                        value
                        outdated
                        updatedAt
                      }                      
                    }
                    cursor
                  }
                  pageInfo {
                    hasNextPage
                  }
                }
              }`,
      variables: { cursor },
    }
  }

  private async isAltMediaOutdated(metaobjectId: string | undefined, locale: LanguageCode = 'en') {
    if (!metaobjectId) return []

    const { query: metaobjectQuery, variables: metaobjectVariables } = this.getMetaobjectQuery(
      metaobjectId,
      locale
    )
    const metaobjectData = (await this.fetchGraphQL(
      metaobjectQuery,
      metaobjectVariables
    )) as MetaobjectTranslation

    const metaobjectEntry = metaobjectData.translatableResource.translations.filter(
      (metaobject) => metaobject.key === 'alts'
    )
    return metaobjectEntry[0]?.outdated !== undefined ? metaobjectEntry[0]?.outdated : true
  }

  /**
   * Generic outdated check for a `value`-keyed translatable metafield (intro, guide, faq).
   * Returns true when the translation for `locale` is missing or Shopify flags it outdated.
   */
  private async isMetafieldValueOutdated(
    metafieldId: string | undefined,
    locale: LanguageCode = 'en'
  ) {
    if (!metafieldId) return false

    const { query, variables } = this.getMetaobjectQuery(metafieldId, locale)
    const data = (await this.fetchGraphQL(query, variables)) as MetaobjectTranslation

    const entry = data.translatableResource.translations.filter(
      (translation) => translation.key === 'value'
    )
    // No translation registered yet → it needs translating; otherwise use Shopify's outdated flag.
    return entry[0]?.outdated !== undefined ? entry[0].outdated : true
  }

  public getCollectionWithOnlyKeyToTranslate(
    collection: CollectionWithOutdatedTranslations,
    isAltMediaOutdated: boolean,
    isIntroOutdated: boolean,
    isGuideOutdated: boolean = false,
    isFaqOutdated: boolean = false,
    isCoconOutdated: boolean = false
  ) {
    const { translations, ...collectionWithoutTranslations } = collection

    const mutableCollection = collectionWithoutTranslations as {
      [key: string]: any
      seo?: { title?: string; description?: string }
    }

    // intro/guide/faq/cocon each live in their own `custom.*` metafield (a separate
    // translatable resource). Keep each only when its translation is missing/outdated;
    // drop the raw metafield wrappers either way.
    delete mutableCollection.introMetafield
    delete mutableCollection.guideMetafield
    delete mutableCollection.faqMetafield
    delete mutableCollection.coconMetafield
    if (isIntroOutdated && collection.introMetafield?.value) {
      mutableCollection.intro = {
        id: collection.introMetafield.id,
        value: collection.introMetafield.value,
      }
    }
    if (isGuideOutdated && collection.guideMetafield?.value) {
      mutableCollection.guide = {
        id: collection.guideMetafield.id,
        value: collection.guideMetafield.value,
      }
    }
    if (isFaqOutdated && collection.faqMetafield?.value) {
      mutableCollection.faq = {
        id: collection.faqMetafield.id,
        value: collection.faqMetafield.value,
      }
    }
    // cocon_links is a JSON [{ url, label }] metafield: the ChatGPT translator translates
    // the labels, and TranslateCollection localizes the URLs (locale prefix + translated
    // handle) afterwards, exactly like the FAQ answers' links.
    if (isCoconOutdated && collection.coconMetafield?.value) {
      mutableCollection.cocon = {
        id: collection.coconMetafield.id,
        value: collection.coconMetafield.value,
      }
    }

    translations.forEach((translation) => {
      const key = this.getKeyFromTranslationKey(translation.key)
      if (!translation.outdated) {
        if (key === 'seo.title') {
          delete mutableCollection.seo?.title
        }
        if (key === 'seo.description') {
          delete mutableCollection.seo?.description
        }
        delete mutableCollection[key]
      }
    })

    const processedMedia = this.getAltMediaToTranslate(collection, isAltMediaOutdated)
    delete mutableCollection.altTextsMetaObject
    mutableCollection.image = processedMedia

    const cleanedCollection = this.cleanResourceEmptyFields({ ...mutableCollection })
    return cleanedCollection
  }

  private getKeyFromTranslationKey(key: string) {
    switch (key) {
      case 'body_html':
        return 'descriptionHtml'
      case 'meta_title':
        return 'seo.title'
      case 'meta_description':
        return 'seo.description'
      default:
        return key
    }
  }

  private getAltMediaToTranslate(
    collection: CollectionWithOutdatedTranslations,
    isAltMediaOutdated: boolean
  ) {
    if (!isAltMediaOutdated || !collection.altTextsMetaObject) return null
    return {
      id: collection.altTextsMetaObject.reference?.id,
      altText: collection.altTextsMetaObject.reference?.field?.jsonValue[0],
    }
  }
}
