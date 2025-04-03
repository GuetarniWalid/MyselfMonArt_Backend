import type { ArticleToTranslate, ArticleWithOutdatedTranslations } from 'Types/Article'
import type { LanguageCode, MetaobjectTranslation } from 'Types/Translation'
import DefaultPullDataModeler from '../PullDataModeler'

export default class PullDataModeler extends DefaultPullDataModeler {
  public async getResourceOutdatedTranslations() {
    const articleToTranslate = [] as Partial<ArticleToTranslate>[]
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

      for (const article of articles) {
        // Check if alt media is outdated
        const isAltMediaOutdated = (await this.isAltMediaOutdated(
          article.node.altTextsMetaObject?.reference?.id
        )) as boolean

        const articleWithOnlyKeyToTranslate = this.getArticleWithOnlyKeyToTranslate(
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
      query: `query AllArticles($cursor: String) {
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

  public getArticleWithOnlyKeyToTranslate(
    article: ArticleWithOutdatedTranslations,
    isAltMediaOutdated: boolean
  ) {
    const { translations, ...articleWithoutTranslations } = article

    const mutableArticle = articleWithoutTranslations as {
      [key: string]: any
    }

    translations.forEach((translation) => {
      const key = this.getKeyFromTranslationKey(translation.key)
      if (!translation.outdated) {
        delete mutableArticle[key]
      }
    })

    const processedMedia = this.getAltMediaToTranslate(article, isAltMediaOutdated)
    delete mutableArticle.altTextsMetaObject
    mutableArticle.image = processedMedia

    const cleanedArticle = this.cleanResourceEmptyFields({ ...mutableArticle })
    return cleanedArticle
  }

  private getKeyFromTranslationKey(key: string) {
    switch (key) {
      case 'body_html':
        return 'body'
      case 'summary_html':
        return 'summary'
      default:
        return key
    }
  }

  private getAltMediaToTranslate(
    article: ArticleWithOutdatedTranslations,
    isAltMediaOutdated: boolean
  ) {
    if (!isAltMediaOutdated || !article.altTextsMetaObject) return null
    return {
      id: article.altTextsMetaObject.reference?.id,
      altText: article.altTextsMetaObject.reference?.field?.jsonValue[0],
    }
  }
}
