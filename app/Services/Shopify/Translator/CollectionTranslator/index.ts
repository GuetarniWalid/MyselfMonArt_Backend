import type { CollectionToTranslate, CollectionWithOutdatedTranslations } from 'Types/Collection'
import type { LanguageCode, TranslationsRegister, MetaobjectTranslation } from 'Types/Translation'
import Authentication from '../../Authentication'
import PullDataModeler from './PullDataModeler'
import PushDataModeler from './PushDataModeler'

export default class CollectionTranslator extends Authentication {
  private pullDataModeler: PullDataModeler
  private pushDataModeler: PushDataModeler

  constructor() {
    super()
    this.pullDataModeler = new PullDataModeler()
    this.pushDataModeler = new PushDataModeler()
  }

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

        const collectionWithOnlyKeyToTranslate =
          this.pullDataModeler.getCollectionWithOnlyKeyToTranslate(
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

  public async updateResourceTranslation({
    resourceToTranslate: collectionToTranslate,
    resourceTranslated: collectionTranslated,
    isoCode,
  }: {
    resourceToTranslate: Partial<CollectionToTranslate>
    resourceTranslated: Partial<CollectionToTranslate>
    isoCode: LanguageCode
  }) {
    try {
      const translationsToRegister = this.pushDataModeler
        .formatTranslationFieldsForGraphQLMutation({
          collectionToTranslate,
          collectionTranslated,
          isoCode,
        })
        .filter((translation) => translation.translations.length > 0)
      console.log('🚀 ~ translationsToRegister:', translationsToRegister)
      let responses = [] as any[]

      for (const translations of translationsToRegister) {
        const { query, variables } = this.updateTranslationQuery(translations)
        const response = await this.fetchGraphQL(query, variables)
        responses.push(response)

        if (!response || response.errors) {
          throw new Error(JSON.stringify(response?.errors))
        }
      }
      return responses
    } catch (error) {
      throw new Error(`Failed to update collection translation: ${error.message}`)
    }
  }

  private updateTranslationQuery(translationsToRegister: TranslationsRegister) {
    return {
      query: `mutation TranslationsRegister($resourceId: ID!, $translations: [TranslationInput!]!) {
          translationsRegister(resourceId: $resourceId, translations: $translations) {
            translations {
              key
              locale
              value
            }
            userErrors {
              field
              message
            }
          }
        }`,
      variables: translationsToRegister,
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

  private getMetaobjectQuery(metaobjectId: string, locale: LanguageCode) {
    return {
      query: `query GetMetaobject($id: ID!) {
        translatableResource(resourceId: $id) {
          translations(locale: "${locale}") {
            key
            locale
            value
            outdated
            updatedAt
          }
        }
      }`,
      variables: { id: metaobjectId },
    }
  }
}
