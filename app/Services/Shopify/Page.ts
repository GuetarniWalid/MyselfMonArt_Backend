import type { Page as ShopifyPage } from 'Types/Page'
import Authentication from './Authentication'

export default class Page extends Authentication {
  public async getAll(): Promise<ShopifyPage[]> {
    const allPages = [] as any[]
    let cursor = null
    let hasNextPage = true

    while (hasNextPage) {
      const { query, variables } = this.getAllPagesQuery(cursor)
      const pagesData = await this.fetchGraphQL(query, variables)
      const pages = pagesData.pages.edges

      // Store the current products
      pages.forEach((page) => allPages.push(page.node))

      // Check for next page
      hasNextPage = pagesData.pages.pageInfo.hasNextPage

      // Get the last cursor
      if (hasNextPage) {
        cursor = pages[pages.length - 1].cursor
      }
    }

    return allPages
  }

  private getAllPagesQuery(cursor: string | null = null) {
    return {
      query: `query GetAllPages($cursor: String) {
                pages(first: 250, after: $cursor) {
                  edges {
                    node {
                      id
                      title
                      body
                      handle
                      metafields(first: 250) {
                        edges {
                          node {
                            namespace
                            key
                            value
                            type
                          }
                        }
                      }
                      translations(locale: "en") {
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

  public async update(pageId: string, newValues: any) {
    const { query, variables } = this.getUpdateQuery(pageId, newValues)
    const response = await this.fetchGraphQL(query, variables)
    if (response.pageUpdate.userErrors.length > 0) {
      throw new Error(response.pageUpdate.userErrors[0].message)
    }
    return response.pageUpdate.page
  }

  private getUpdateQuery(pageId: string, newValues: any) {
    return {
      query: `mutation PageUpdate($id: ID!, $page: PageUpdateInput!) {
                pageUpdate(id: $id, page: $page) {
                  page {
                    id
                  }
                  userErrors {
                    field
                    message
                  }
                }
              }`,
      variables: {
        id: isNaN(Number(pageId)) ? pageId : `gid://shopify/Page/${pageId}`,
        page: {
          redirectNewHandle: true,
          ...newValues,
        },
      },
    }
  }
}
