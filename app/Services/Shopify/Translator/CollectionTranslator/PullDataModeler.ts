import type { CollectionWithOutdatedTranslations } from 'Types/Collection'
import type { LanguageCode, MetaobjectTranslation } from 'Types/Translation'
import DefaultPullDataModeler from '../PullDataModeler'

export default class PullDataModeler extends DefaultPullDataModeler {
  public async getResourceOutdatedTranslations() {
    const collectionToTranslate = [] as any[]
    let cursor: string | null = null
    let hasNextPage = true

    while (hasNextPage) {
      // Get collections with outdated translations without metaobject translations
      const { query, variables } = this.getCollectionsWithOutdatedTranslationsQuery(cursor)
      const collectionsData = await this.fetchGraphQL(query, variables)
      const collections = collectionsData.collections.edges as {
        node: CollectionWithOutdatedTranslations
        cursor: string
      }[]

      for (const collection of collections) {
        // Check if alt media is outdated
        const isAltMediaOutdated = (await this.isAltMediaOutdated(
          collection.node.altTextsMetaObject?.reference?.id
        )) as boolean

        // Check if the "intro" metafield (custom.intro) translation is missing/outdated.
        // This is the intro text rendered at the top of the storefront collection page.
        const isIntroOutdated = await this.isIntroOutdated(collection.node.introMetafield?.id)

        const collectionWithOnlyKeyToTranslate = this.getCollectionWithOnlyKeyToTranslate(
          collection.node,
          isAltMediaOutdated,
          isIntroOutdated
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

  private async isAltMediaOutdated(metaobjectId: string | undefined) {
    if (!metaobjectId) return []

    const { query: metaobjectQuery, variables: metaobjectVariables } = this.getMetaobjectQuery(
      metaobjectId,
      'en'
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

  private async isIntroOutdated(metafieldId: string | undefined) {
    if (!metafieldId) return false

    const { query, variables } = this.getMetaobjectQuery(metafieldId, 'en')
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
    isIntroOutdated: boolean
  ) {
    const { translations, ...collectionWithoutTranslations } = collection

    const mutableCollection = collectionWithoutTranslations as {
      [key: string]: any
      seo?: { title?: string; description?: string }
    }

    // The intro lives in a metafield (separate translatable resource). Keep it only
    // when its translation is missing/outdated; drop the raw metafield wrapper either way.
    delete mutableCollection.introMetafield
    if (isIntroOutdated && collection.introMetafield?.value) {
      mutableCollection.intro = {
        id: collection.introMetafield.id,
        value: collection.introMetafield.value,
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
