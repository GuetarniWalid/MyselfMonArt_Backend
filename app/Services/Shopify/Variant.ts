import Authentication from './Authentication'

export default class Variant extends Authentication {
  /**
   * Painting variant
   */
  public async getVariantById(variantId: string) {
    const { query, variables } = this.getVariantQuery(variantId)
    const response = await this.fetchGraphQL(query, variables)
    return response.productVariant
  }

  private getVariantQuery(variantId: string) {
    return {
      query: `query getVariant($id: ID!) {
        productVariant(id: $id) {
          id
          title
          product {
            title
          }
        }
      }`,
      variables: { id: `gid://shopify/ProductVariant/${variantId}` },
    }
  }
}
