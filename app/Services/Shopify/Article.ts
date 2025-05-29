import type { Article as ShopifyArticle } from 'Types/Article'
import Authentication from './Authentication'

export default class Article extends Authentication {
  public async getAll(): Promise<ShopifyArticle[]> {
    const allArticles = [] as any[]
    let cursor = null
    let hasNextPage = true

    while (hasNextPage) {
      const { query, variables } = this.getAllArticlesQuery(cursor)
      const articlesData = await this.fetchGraphQL(query, variables)
      const articles = articlesData.articles.edges

      // Store the current products
      articles.forEach((article) => allArticles.push(article.node))

      // Check for next page
      hasNextPage = articlesData.articles.pageInfo.hasNextPage

      // Get the last cursor
      if (hasNextPage) {
        cursor = articles[articles.length - 1].cursor
      }
    }

    return allArticles
  }

  private getAllArticlesQuery(cursor: string | null = null) {
    return {
      query: `query GetAllArticles($cursor: String) {
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
                      metafields(first: 10) {
                        edges {
                          node {
                            namespace
                            key
                            reference {
                              ...on Metaobject {
                                id
                                type
                                field(key: "alts") {
                                  key
                                  jsonValue
                                }
                              }
                            }
                          }
                        }
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

  public async update(articleId: string, newValues: any) {
    const { query, variables } = this.getUpdateQuery(articleId, newValues)
    const response = await this.fetchGraphQL(query, variables)
    return response.articleUpdate.article
  }

  private getUpdateQuery(articleId: string, newValues: any) {
    return {
      query: `mutation ArticleUpdate($id: ID!, $article: ArticleUpdateInput!) {
                articleUpdate(id: $id, article: $article) {
                  article {
                    id
                  }
                }
              }`,
      variables: {
        id: isNaN(Number(articleId)) ? articleId : `gid://shopify/Article/${articleId}`,
        article: {
          redirectNewHandle: true,
          ...newValues,
        },
      },
    }
  }
}
