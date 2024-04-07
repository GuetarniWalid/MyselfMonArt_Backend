import axios, { AxiosInstance } from 'axios'
import Env from '@ioc:Adonis/Core/Env'

export default class Shopify {
  private shopUrl = Env.get('SHOPIFY_SHOP_URL')
  private apiVersion = Env.get('SHOPIFY_API_VERSION')
  private accessToken = Env.get('SHOPIFY_ACCESS_TOKEN_SECRET')
  private endpoints = {
    product: 'products.json',
    order: 'products.json',
  }
  private client: AxiosInstance
  private urlGraphQL = `${this.shopUrl}/${this.apiVersion}/graphql.json`

  constructor(endpoint: 'product' | 'order') {
    this.client = axios.create({
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': this.accessToken,
      },
      baseURL: `${this.shopUrl}/${this.apiVersion}/${this.endpoints[endpoint]}`,
    })
  }

  public async createProduct(product: CreateProduct) {
    const response = await this.client.request({ method: 'POST', data: { product } })
    const productCreated = response.data.product as ProductCreated
    return {
      variantID: productCreated.variants[0].id,
    }
  }

  public async updateProductVariant(product: UpdateProduct) {
    const optionsAndvariantsQuery = this.getOptionsAndVariantsQuery(product.productId)
    const data = await this.fetchGraphQL(optionsAndvariantsQuery)

    const nbOfOptions = data.product.options.length
    const variants = data.product.variants

    let createFirstVariant = false
    if (nbOfOptions > 1) {
      await this.deleteAllVariants(product.productId, variants)
      createFirstVariant = true
    }
    const graphQLVariantId = createFirstVariant
      ? await this.createFirstVariant(product.productId, product.variant)
      : await this.createVariant(product.productId, product.variant)
    const graphQLVariantIdSplit = graphQLVariantId.split('/')
    const newVariantId = graphQLVariantIdSplit[graphQLVariantIdSplit.length - 1]
    return newVariantId
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
            }
          }
        }
      }
    }`
  }

  private async deleteAllVariants(
    productId: number,
    variants: { edges: { node: { id: string } }[] }
  ) {
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

  private async getVariantIds(variants: { edges: { node: { id: string } }[] }) {
    const variantIds = variants.edges.map((edge) => edge.node.id)
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
    await this.fetchGraphQL(queryUpdate, variablesUpdate)
    return variantId
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

  private getVariantUpdateMutationsQuery(variantId: string, variant: Variant) {
    return {
      query: `mutation updateProductVariantMetafields($input: ProductVariantInput!) {
        productVariantUpdate(input: $input) {
          userErrors {
            message
            field
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
    if (variantMutationsData.productVariantCreate.userErrors.length > 0) {
      const variantsQuery = this.getVariantsQuery(productId)
      const data = await this.fetchGraphQL(variantsQuery)
      const variants = data.product.variants.edges
      const currentVariant = variants.find((v) => v.node.title === variant.title)
      return currentVariant.node.id
    } else {
      return variantMutationsData.productVariantCreate.productVariant.id
    }
  }

  private getCreateVariantMutationsQuery(productId: number, variant: Variant) {
    return {
      query: `mutation productVariantCreate($input: ProductVariantInput!) {
        productVariantCreate(input: $input) {
          productVariant {
            id
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

  private getVariantsQuery(productId: number) {
    return `query {
      product(id: "gid://shopify/Product/${productId}") {
        variants(first: 100) {
          edges {
            node {
              id
              title
            }
          }
        }
      }
    }`
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
}
