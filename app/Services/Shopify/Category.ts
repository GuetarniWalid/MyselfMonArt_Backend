import Authentication from './Authentication'

/**
 * Shopify Product Category Service
 * Handles product categorization using Shopify's Standard Product Taxonomy
 */
export default class Category extends Authentication {
  /**
   * Set product category using Shopify's Standard Product Taxonomy
   * @param productId - Product GID (e.g., "gid://shopify/Product/123")
   * @param categoryGid - Category GID (e.g., "gid://shopify/TaxonomyCategory/hg-3-4-2")
   * @throws Error if category update fails or returns userErrors
   */
  public async setProductCategory(productId: string, categoryGid: string): Promise<void> {
    const { query, variables } = this.getSetCategoryQuery(productId, categoryGid)

    const response = await this.fetchGraphQL(query, variables, 10)

    if (response.productUpdate?.userErrors?.length > 0) {
      const error = response.productUpdate.userErrors[0]
      throw new Error(`${error.field}: ${error.message}`)
    }

    if (!response.productUpdate?.product) {
      throw new Error('Product update returned no product data')
    }
  }

  /**
   * Build GraphQL mutation for setting product category
   * @param productId - Product GID
   * @param categoryGid - Category GID
   * @returns GraphQL query and variables
   */
  private getSetCategoryQuery(productId: string, categoryGid: string) {
    const query = `
      mutation ProductUpdate($input: ProductInput!) {
        productUpdate(input: $input) {
          product {
            id
            category {
              id
              fullName
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `

    const variables = {
      input: {
        id: productId,
        category: categoryGid,
      },
    }

    return { query, variables }
  }
}
