import type {
  CreateProduct,
  ProductCreated,
  UpdateProductPainting,
  UpdateProductTapestry,
  Product as ShopifyProduct,
  ProductByTag,
  ProductById,
} from 'Types/Product'
import Authentication from '../Authentication'
import Metafield from '../Metafield'
import Variant from '../Variant'
import ModelCopier from './Modelcopier'

export default class Product extends Authentication {
  public modelCopier: ModelCopier

  constructor() {
    super()
    this.modelCopier = new ModelCopier()
  }

  public async create(product: CreateProduct) {
    const response = await this.client.request({
      method: 'POST',
      url: 'products.json',
      data: { product },
    })
    const productCreated = response.data.product as ProductCreated
    return {
      variantID: productCreated.variants[0].id,
    }
  }

  public async getAll(): Promise<ShopifyProduct[]> {
    const allProducts = [] as any[]
    let cursor = null
    let hasNextPage = true

    while (hasNextPage) {
      const { query, variables } = this.getAllProductsQuery(cursor)
      const productsData = await this.fetchGraphQL(query, variables)
      const products = productsData.products.edges

      // Store the current products
      products.forEach((product) => allProducts.push(product.node))

      // Check for next page
      hasNextPage = productsData.products.pageInfo.hasNextPage

      // Get the last cursor
      if (hasNextPage) {
        cursor = products[products.length - 1].cursor
      }
    }

    return allProducts
  }

  private getAllProductsQuery(cursor: string | null = null) {
    return {
      query: `query GetAllProducts($cursor: String) {
                products(first: 250, after: $cursor, query: "published_status:published") {
                  edges {
                    node {
                      id
                      title
                      description
                      handle
                      hasOnlyDefaultVariant
                      media(first: 10, sortKey: POSITION) {
                        nodes {
                          alt
                          mediaContentType
                          ... on MediaImage {
                            image {
                              width
                              height
                              url
                            }
                          }
                        }
                      }
                      metafields(first: 10) {
                        edges {
                          node {
                            namespace
                            key
                            reference {
                              ... on Collection {
                                title
                              }
                              ...on Metaobject {
                                id
                                type
                                field(key: "alts") {
                                  key
                                  value
                                }
                              }
                            }
                          }
                        }
                      }
                      onlineStoreUrl
                      options(first: 3) {
                        id
                        name
                        values
                      }
                      seo {
                        title
                        description
                      }
                      tags
                      templateSuffix
                      vendor
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

  public async updateTapestryVariant(product: UpdateProductPainting | UpdateProductTapestry) {
    const variant = new Variant()
    if (product.type === 'tapestry') {
      return variant.updateTapestry(product)
    }
  }

  public async updateMetafieldLikesCount({
    productId,
    action,
  }: {
    productId: number
    action: 'increment' | 'decrement'
  }) {
    const metafield = new Metafield()
    const newCount =
      action === 'increment'
        ? await metafield.increment(productId, 'likes', 'number')
        : await metafield.decrement(productId, 'likes', 'number')
    return newCount
  }

  public async deleteAllOptions(productId: string) {
    const product = await this.getProductById(productId)
    const optionIds = product.options.map((option) => option.id)
    const deletedOptionsIds = await this.deleteOptions(productId, optionIds)
    return deletedOptionsIds
  }

  public async deleteOptions(productId: string, optionIds: string[]) {
    const { query, variables } = this.getDeleteOptionsQuery(productId, optionIds)
    const response = await this.fetchGraphQL(query, variables)

    if (response.userErrors?.length) {
      throw new Error(response.userErrors[0].message)
    }

    return response.productOptionsDelete.deletedOptionsIds
  }

  private getDeleteOptionsQuery(productId: string, optionIds: string[]) {
    return {
      query: `
        mutation productOptionsDelete($productId: ID!, $options: [ID!]!, $strategy: ProductOptionDeleteStrategy!) {
          productOptionsDelete(productId: $productId, options: $options, strategy: $strategy) {
            deletedOptionsIds
            userErrors {
              field
              message
            }
          }
        }
      `,
      variables: {
        productId,
        options: optionIds,
        strategy: 'POSITION',
      },
    }
  }

  public async getProductById(productId: string) {
    const { query, variables } = this.getProductByIdQuery(productId)
    const response = await this.fetchGraphQL(query, variables)
    return response.product as ProductById
  }

  private getProductByIdQuery(productId: string) {
    const id = isNaN(Number(productId)) ? productId : `gid://shopify/Product/${productId}`

    return {
      query: `query Product($id: ID!) {
        product(id: $id) {
          id
          title
          description
          handle
          hasOnlyDefaultVariant
          tags
          templateSuffix
          media(first: 10) {
            nodes {
              alt
              ... on MediaImage {
                image {
                  width
                  height
                }
              }
            }
          }
          altTextsMetaObject: metafield(namespace: "meta_object", key: "media") {
            id
            value
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
          paintingOptionsMetafields: metafields(first: 20, namespace: "painting_options") {
            nodes {
              id
              namespace
              key
              type
              references(first: 30) {
                edges {
                  node {
                    ... on Metaobject {
                      id
                    }
                  }
                }
              }
            }
          }
          options(first: 10) {
            id
            name
            optionValues {
              id
              name
            }
          }
          variants(first: 100) {
            nodes {
              id
              title
              price
              selectedOptions {
                name
                value
              }
            }
          }
        }
      }`,
      variables: { id },
    }
  }

  public async update(productId: string, newValues: any) {
    const { query, variables } = this.getUpdateQuery(productId, newValues)
    const response = await this.fetchGraphQL(query, variables)
    return response.productUpdate.product
  }

  private getUpdateQuery(productId: string, newValues: any) {
    return {
      query: `mutation ProductUpdate($input: ProductInput!) {
        productUpdate(input: $input) {
          product {
            id
          }
        }
      }`,
      variables: {
        input: {
          id: isNaN(Number(productId)) ? productId : `gid://shopify/Product/${productId}`,
          redirectNewHandle: true,
          ...newValues,
        },
      },
    }
  }

  public async createMetaObject(type: string, key: string, value: string[]) {
    const { query, variables } = this.getcreateMetaObjectQuery(type, key, value)
    const response = await this.fetchGraphQL(query, variables)
    return response.metaobjectCreate
  }

  private getcreateMetaObjectQuery(type: string, key: string, value: string[]) {
    return {
      query: `mutation CreateMetaobject($metaobject: MetaobjectCreateInput!) {
        metaobjectCreate(metaobject: $metaobject) {
          metaobject {
            id
          }
          userErrors {
            field
            message
            code
          }
        }
      }`,
      variables: {
        metaobject: {
          type,
          fields: [
            {
              key,
              value: JSON.stringify(value),
            },
          ],
        },
      },
    }
  }

  public async createOptions(
    productId: string,
    options: Array<{ name: string; values: string[] }>
  ) {
    const { query, variables } = this.getCreateOptionsQuery(productId, options)
    const response = await this.fetchGraphQL(query, variables)
    return response.productOptionsCreate
  }

  private getCreateOptionsQuery(
    productId: string,
    options: Array<{ name: string; values: string[] }>
  ) {
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
            options {
              id
              name
              values
            }
          }
        }
      }`,
      variables: {
        productId,
        options: options.map((option) => ({
          name: option.name,
          values: option.values.map((value) => ({
            name: value,
          })),
        })),
        variantStrategyvariantStrategy: 'LEAVE_AS_ISLEAVE_AS_IS',
      },
    }
  }

  public getTagByRatio(ratio: number, isPersonalized = false) {
    if (ratio > 1) return isPersonalized ? 'personalized paysage model' : 'paysage model'
    if (ratio < 1) return isPersonalized ? 'personalized portrait model' : 'portrait model'
    return isPersonalized ? 'personalized square model' : 'square model'
  }

  public async getProductByTag(tag: string) {
    const { query, variables } = this.getProductByTagQuery(tag)
    const response = await this.fetchGraphQL(query, variables)
    return response.products.edges[0].node as ProductByTag
  }

  private getProductByTagQuery(tag: string) {
    return {
      query: `query GetProductByTag {
        products(first: 1, query: "tag:${tag}") {
          edges {
            node {
              id
              paintingOptionsMetafields: metafields(first: 20, namespace: "painting_options") {
                nodes {
                  id
                  namespace
                  key
                  type
                  references(first: 30) {
                    edges {
                      node {
                        ... on Metaobject {
                          id
                        }
                      }
                    }
                  }
                }
              }
              options(first: 3) {
                id
                name
                values
              }
              variants(first: 100) {
                nodes {
                  id
                  price
                  selectedOptions {
                    name
                    value
                  }
                }
              }
            }
          }
        }
      }`,
      variables: {},
    }
  }

  public async createVariantsBulk(
    productId: string,
    variants: Array<{
      price: string
      optionValues: {
        name: string
        optionName: string
      }[]
    }>
  ) {
    const { query, variables } = this.getCreateVariantsBulkQuery(productId, variants)
    const response = await this.fetchGraphQL(query, variables)

    if (response.productVariantsBulkCreate.userErrors?.length) {
      throw new Error(response.productVariantsBulkCreate.userErrors[0].message)
    }

    return response.productVariantsBulkCreate.productVariants
  }

  private getCreateVariantsBulkQuery(
    productId: string,
    variants: Array<{
      price: string
      optionValues: {
        name: string
        optionName: string
      }[]
    }>
  ) {
    return {
      query: `mutation ProductVariantsCreate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
        productVariantsBulkCreate(productId: $productId, variants: $variants) {
          productVariants {
            id
            title
            selectedOptions {
              name
              value
            }
          }
          userErrors {
            field
            message
          }
        }
      }`,
      variables: {
        productId: isNaN(Number(productId)) ? productId : `gid://shopify/Product/${productId}`,
        variants: variants.map((variant) => ({
          ...variant,
          inventoryItem: {
            tracked: false,
          },
          inventoryPolicy: 'CONTINUE',
        })),
      },
    }
  }

  public async updateVariant(productId: string, variantId: string, payload: any) {
    console.log('🚀 ~ variantId:', variantId)
    const { query, variables } = this.getUpdateVariantQuery(productId, variantId, payload)
    const response = await this.fetchGraphQL(query, variables)

    if (response.productVariantsBulkUpdate.userErrors?.length) {
      throw new Error(response.productVariantsBulkUpdate.userErrors[0].message)
    }

    return response.productVariantsBulkUpdate.product
  }

  private getUpdateVariantQuery(productId: string, variantId: string, payload: any) {
    return {
      query: `mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
                productVariantsBulkUpdate(productId: $productId, variants: $variants) {
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
        productId,
        variants: [
          {
            id: variantId,
            inventoryPolicy: 'CONTINUE',
            ...payload,
          },
        ],
      },
    }
  }
}
