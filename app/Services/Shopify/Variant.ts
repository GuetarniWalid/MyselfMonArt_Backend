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

  /**
   * Variante + ses options sélectionnées (name/value) — sert de table de correspondance
   * variantId -> format/finition pour le studio CustomArt (le front n'envoie que la
   * variante choisie, le back dérive les champs métier).
   */
  public async getVariantWithOptions(variantId: string) {
    const response = await this.fetchGraphQL(
      `query getVariantOptions($id: ID!) {
        productVariant(id: $id) {
          id
          title
          selectedOptions {
            name
            value
          }
          product {
            id
            title
          }
        }
      }`,
      { id: `gid://shopify/ProductVariant/${variantId}` }
    )
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
