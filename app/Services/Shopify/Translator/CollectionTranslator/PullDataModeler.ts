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

        const collectionWithOnlyKeyToTranslate = this.getCollectionWithOnlyKeyToTranslate(
          collection.node,
          isAltMediaOutdated
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
      query: `query GetUpdatedCollections($cursor: String) {
                collections(first: 250, after: $cursor, query: "published_status:published") {
                  edges {
                    node {
                      id
                      title
                      descriptionHtml
                      handle
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

  public getCollectionWithOnlyKeyToTranslate(
    collection: CollectionWithOutdatedTranslations,
    isAltMediaOutdated: boolean
  ) {
    const { translations, ...collectionWithoutTranslations } = collection

    const mutableCollection = collectionWithoutTranslations as {
      [key: string]: any
      seo?: { title?: string; description?: string }
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
      case 'product_type':
        return 'productType'
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
