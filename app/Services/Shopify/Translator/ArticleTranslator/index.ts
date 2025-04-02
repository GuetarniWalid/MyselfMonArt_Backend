import type { ArticleToTranslate, ArticleWithOutdatedTranslations } from 'Types/Article'
import type { LanguageCode, TranslationsRegister, MetaobjectTranslation } from 'Types/Translation'
import Authentication from '../../Authentication'
import PullDataModeler from './PullDataModeler'
import PushDataModeler from './PushDataModeler'

export default class ArticleTranslator extends Authentication {
  private pullDataModeler: PullDataModeler
  private pushDataModeler: PushDataModeler

  constructor() {
    super()
    this.pullDataModeler = new PullDataModeler()
    this.pushDataModeler = new PushDataModeler()
  }

  public async getResourceOutdatedTranslations() {
    const articleToTranslate = [] as any[]
    let cursor: string | null = null
    let hasNextPage = true

    while (hasNextPage) {
      // Get articles with outdated translations without metaobject translations
      const { query, variables } = this.getArticlesWithOutdatedTranslationsQuery(cursor)
      const articlesData = await this.fetchGraphQL(query, variables)
      const articles = articlesData.articles.edges as {
        node: ArticleWithOutdatedTranslations
        cursor: string
      }[]

      for (const article of articles.slice(0, 1)) {
        // Check if alt media is outdated
        const isAltMediaOutdated = (await this.isAltMediaOutdated(
          article.node.altTextsMetaObject?.reference?.id
        )) as boolean

        const articleWithOnlyKeyToTranslate = this.pullDataModeler.getArticleWithOnlyKeyToTranslate(
          article.node,
          isAltMediaOutdated
        )
        if (articleWithOnlyKeyToTranslate) {
          articleToTranslate.push(articleWithOnlyKeyToTranslate)
        }
      }

      hasNextPage = articlesData.articles.pageInfo.hasNextPage
      if (hasNextPage) {
        cursor = articles[articles.length - 1].cursor
      }
    }

    return articleToTranslate
  }

  private getArticlesWithOutdatedTranslationsQuery(
    cursor: string | null = null,
    locale: LanguageCode = 'en'
  ) {
    return {
      query: `query GetUpdatedArticles($cursor: String) {
                articles(first: 250, after: $cursor, query: "published_status:published") {
                  edges {
                    node {
                      id
                      title
                      body
                      summary
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
    resourceToTranslate: articleToTranslate,
    resourceTranslated: articleTranslated,
    isoCode,
  }: {
    resourceToTranslate: Partial<ArticleToTranslate>
    resourceTranslated: Partial<ArticleToTranslate>
    isoCode: LanguageCode
  }) {
    try {
      const translationsToRegister = this.pushDataModeler
        .formatTranslationFieldsForGraphQLMutation({
          articleToTranslate,
          articleTranslated,
          isoCode,
        })
        .filter((translation) => translation.translations.length > 0)
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
      throw new Error(`Failed to update article translation: ${error.message}`)
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
