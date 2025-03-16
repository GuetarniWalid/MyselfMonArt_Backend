import type { UpdateProductPainting, UpdateProductTapestry } from 'Types/Product'
import Authentication from './Authentication'
import type { Variant } from 'Types/Variant'

export default class SVariant extends Authentication {
  /**
   * Painting variant
   */

  public async updatePainting(product: UpdateProductPainting) {
    const optionsAndvariantsQuery = this.getOptionsAndVariantsQuery(product.productId)
    const data = await this.fetchGraphQL(optionsAndvariantsQuery)

    const nbOfOptions = data.product.options.length
    const variants = data.product.variants.edges
    const isDefaultOption = data.product.options[0].values.includes('Default Title')

    if (nbOfOptions > 1 || isDefaultOption) {
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
          this.getVariantUpdateMutationsQuery(
            product.productId,
            variantAlreadyExist.node.id,
            product.variant
          )
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
      productId,
      variantId,
      variant
    )
    const { productVariantsBulkUpdate } = await this.fetchGraphQL(queryUpdate, variablesUpdate)
    const { productVariants, userErrors } = productVariantsBulkUpdate

    if (userErrors.length > 0) {
      console.log('🚀 ~ ', userErrors)
      throw new Error(userErrors[0].message)
    }
    return {
      id: this.extractIdFromGid(variantId),
      price: productVariants[0].price,
      title: productVariants[0].title,
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
            name: 'Titre',
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

  private getVariantUpdateMutationsQuery(productId: number, variantId: string, variant: Variant) {
    return {
      query: `mutation ProductVariantsUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
        productVariantsBulkUpdate(productId: $productId, variants: $variants) {
          userErrors {
            message
            field
          }
          productVariants {
            price
            title
          }
        }
      }`,
      variables: {
        productId: `gid://shopify/Product/${productId}`,
        variants: [
          {
            id: variantId,
            price: variant.price,
            inventoryPolicy: 'CONTINUE',
            optionValues: [
              {
                name: variant.title,
                optionName: 'Titre',
              },
            ],
          },
        ],
      },
    }
  }

  private async createVariant(productId: number, variant: Variant) {
    const { query, variables } = this.getCreateVariantMutationsQuery(productId, variant)
    const { productVariantsBulkCreate } = await this.fetchGraphQL(query, variables)
    const { productVariants, userErrors } = productVariantsBulkCreate

    if (userErrors.length > 0) {
      console.log('🚀 ~ ', userErrors)
      throw new Error(userErrors[0].message)
    }

    return {
      id: this.extractIdFromGid(productVariants[0].id),
      price: productVariants[0].price,
      title: productVariants[0].title,
    }
  }

  private getCreateVariantMutationsQuery(productId: number, variant: Variant) {
    return {
      query: `mutation productVariantsCreate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
        productVariantsBulkCreate(productId: $productId, variants: $variants) {
          productVariants {
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
        productId: `gid://shopify/Product/${productId}`,
        variants: [
          {
            price: variant.price,
            inventoryPolicy: 'CONTINUE',
            optionValues: [
              {
                name: variant.title,
                optionName: 'Titre',
              },
            ],
          },
        ],
      },
    }
  }

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
          this.getVariantUpdateMutationsQuery(
            product.productId,
            variantAlreadyExist.node.id,
            product.variant
          )
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
