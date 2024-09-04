import Authentication from './Authentication'

export default class SVariant extends Authentication {
  private urlGraphQL = `${this.shopUrl}/${this.apiVersion}/graphql.json`

  constructor() {
    super()
  }

  /**
   * Painting variant
   */

  public async updatePainting(product: UpdateProductPainting) {
    const optionsAndvariantsQuery = this.getOptionsAndVariantsQuery(product.productId)
    const data = await this.fetchGraphQL(optionsAndvariantsQuery)

    const nbOfOptions = data.product.options.length
    const variants = data.product.variants.edges

    if (nbOfOptions > 1) {
      await this.deleteAllVariants(product.productId, variants)
      return this.createFirstVariant(product.productId, product.variant)
    }

    const variantAlreadyExist = variants.find((v) => v.node.title === product.variant.title)
    if (variantAlreadyExist) {
      if (Number(variantAlreadyExist.node.price) === Number(product.variant.price)) {
        return {
          id: this.extractIdFromGid(variantAlreadyExist.node.id),
          price: variantAlreadyExist.node.price,
          title: variantAlreadyExist.node.title,
        }
      } else {
        const { query: queryUpdate, variables: variablesUpdate } =
          this.getVariantUpdateMutationsQuery(variantAlreadyExist.node.id, product.variant)
        const variantMutationsOtherData = await this.fetchGraphQL(queryUpdate, variablesUpdate)
        return {
          id: this.extractIdFromGid(variantAlreadyExist.node.id),
          price: variantMutationsOtherData.productVariantUpdate.productVariant.price,
          title: variantMutationsOtherData.productVariantUpdate.productVariant.title,
        }
      }
    }

    // Create a new variant
    const variantData = await this.createVariant(product.productId, product.variant)
    return variantData
  }

  private getOptionsAndVariantsQuery(productId: number) {
    return `query {
      product(id: "gid://shopify/Product/${productId}") {
        options {
          id
          name
          values
        }
        variants(first: 250) {
          edges {
            node {
              id
              title
              price
            }
          }
        }
      }
    }`
  }

  private async deleteAllVariants(productId: number, variants: { node: { id: string } }[]) {
    const variantIds = await this.getVariantIds(variants)
    const { query, variables } = this.getDeleteVariantMutationsQuery(productId, variantIds)
    await this.fetchGraphQL(query, variables)
  }

  private getDeleteVariantMutationsQuery(productId: number, variantsIds: string[]) {
    return {
      query: `mutation bulkDeleteProductVariants($productId: ID!, $variantsIds: [ID!]!) {
      productVariantsBulkDelete(productId: $productId, variantsIds: $variantsIds) {
        product {
          id
        }
        userErrors {
          field
          message
        }
      }
    }`,
      variables: {
        productId: `gid://shopify/Product/${productId}`,
        variantsIds,
      },
    }
  }

  private async getVariantIds(variants: { node: { id: string } }[]) {
    const variantIds = variants.map((v) => v.node.id)
    return variantIds
  }

  private async createFirstVariant(productId: number, variant: Variant) {
    const { query, variables } = this.getCreateFirstVariantMutationsQuery(productId, variant)
    const variantMutationsData = await this.fetchGraphQL(query, variables)
    const variantId = variantMutationsData.productOptionsCreate.product.variants.nodes[0].id
    const { query: queryUpdate, variables: variablesUpdate } = this.getVariantUpdateMutationsQuery(
      variantId,
      variant
    )
    const variantMutationsOtherData = await this.fetchGraphQL(queryUpdate, variablesUpdate)
    return {
      id: this.extractIdFromGid(variantId),
      price: variantMutationsOtherData.productVariantUpdate.productVariant.price,
      title: variantMutationsOtherData.productVariantUpdate.productVariant.title,
    }
  }

  private getCreateFirstVariantMutationsQuery(productId: number, variant: Variant) {
    return {
      query: `mutation createOptions($productId: ID!, $options: [OptionCreateInput!]!) {
        productOptionsCreate(productId: $productId, options: $options) {
          userErrors {
            field
            message
            code
          }
          product {
            id
            variants(first: 1) {
              nodes {
                id
              }
            }
          }
        }
      }`,
      variables: {
        productId: `gid://shopify/Product/${productId}`,
        options: [
          {
            name: 'Title',
            values: [
              {
                name: variant.title,
              },
            ],
          },
        ],
      },
    }
  }

  private extractIdFromGid(gid: string) {
    const gidSplit = gid.split('/')
    return gidSplit[gidSplit.length - 1]
  }

  private getVariantUpdateMutationsQuery(variantId: string, variant: Variant) {
    return {
      query: `mutation updateProductVariantMetafields($input: ProductVariantInput!) {
        productVariantUpdate(input: $input) {
          userErrors {
            message
            field
          }
          productVariant {
            price
            title
          }
        }
      }`,
      variables: {
        input: {
          id: variantId,
          price: variant.price,
          inventoryManagement: 'NOT_MANAGED',
        },
      },
    }
  }

  private async createVariant(productId: number, variant: Variant) {
    const { query, variables } = this.getCreateVariantMutationsQuery(productId, variant)
    const variantMutationsData = await this.fetchGraphQL(query, variables)
    return {
      id: this.extractIdFromGid(variantMutationsData.productVariantCreate.productVariant.id),
      price: variantMutationsData.productVariantCreate.productVariant.price,
      title: variantMutationsData.productVariantCreate.productVariant.title,
    }
  }

  private getCreateVariantMutationsQuery(productId: number, variant: Variant) {
    return {
      query: `mutation productVariantCreate($input: ProductVariantInput!) {
        productVariantCreate(input: $input) {
          productVariant {
            id
            title
            price
          }
          userErrors {
            field
            message
          }
        }
      }`,
      variables: {
        input: {
          productId: `gid://shopify/Product/${productId}`,
          options: variant.title,
          price: variant.price,
          inventoryManagement: 'NOT_MANAGED',
        },
      },
    }
  }

  private async fetchGraphQL(query, variables = {}) {
    const response = await fetch(this.urlGraphQL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': this.accessToken,
      },
      body: JSON.stringify({ query, variables }),
    })

    const responseBody = await response.json()

    if (responseBody.errors) {
      console.error('Shopify GraphQL errors:', responseBody.errors)
      throw new Error('Failed to fetch Shopify GraphQL API')
    }

    return responseBody.data
  }

  /**
   * Tapestry variant
   */

  public async updateTapestry(product: UpdateProductTapestry) {
    const optionsAndvariantsQuery = this.getOptionsAndVariantsQuery(product.productId)
    const data = await this.fetchGraphQL(optionsAndvariantsQuery)
    const variants = data.product.variants.edges

    if (variants.length === 1 && variants[0].node.title === 'Default Title') {
      return this.createFirstVariant(product.productId, product.variant)
    }

    const variantAlreadyExist = variants.find((v) => v.node.title === product.variant.title)
    if (variantAlreadyExist) {
      if (Number(variantAlreadyExist.node.price) === Number(product.variant.price)) {
        return {
          id: this.extractIdFromGid(variantAlreadyExist.node.id),
          price: variantAlreadyExist.node.price,
          title: variantAlreadyExist.node.title,
        }
      } else {
        const { query: queryUpdate, variables: variablesUpdate } =
          this.getVariantUpdateMutationsQuery(variantAlreadyExist.node.id, product.variant)
        const variantMutationsOtherData = await this.fetchGraphQL(queryUpdate, variablesUpdate)
        return {
          id: this.extractIdFromGid(variantAlreadyExist.node.id),
          price: variantMutationsOtherData.productVariantUpdate.productVariant.price,
          title: variantMutationsOtherData.productVariantUpdate.productVariant.title,
        }
      }
    }

    // Create a new variant
    const variantData = await this.createVariant(product.productId, product.variant)
    return variantData
  }
}
