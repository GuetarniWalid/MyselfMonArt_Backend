import type {
  CreateProduct,
  ProductCreated,
  UpdateProductPainting,
  UpdateProductTapestry,
  Product as ShopifyProduct,
} from 'Types/Product'
import Authentication from './Authentication'
import Metafield from './Metafield'
import Variant from './Variant'

export default class Product extends Authentication {
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
                      options(first: 3) {
                        id
                        name
                      }
                      seo {
                        title
                        description
                      }
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

  public async updateVariant(product: UpdateProductPainting | UpdateProductTapestry) {
    const variant = new Variant()
    if (product.type === 'painting') {
      return variant.updatePainting(product)
    } else if (product.type === 'tapestry') {
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
    const metafield = new Metafield('products', productId)
    const newCount =
      action === 'increment'
        ? await metafield.increment('likes', 'number')
        : await metafield.decrement('likes', 'number')
    return newCount
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
    return response.product
  }

  private getProductByIdQuery(productId: string) {
    return {
      query: `query Product($id: ID!) {
        product(id: $id) {
          id
          title
          description
          handle
          hasOnlyDefaultVariant
          media(first: 10) {
            nodes {
              alt
            }
          }
          altTextsMetaObject: metafield(namespace: "meta_object", key: "media") {
            value
          }
          options(first: 10) {
            name
            optionValues {
              id
              name
            }
          }
          variants(first: 10) {
            nodes {
              id
              title
            }
          }
        }
      }`,
      variables: { id: `gid://shopify/Product/${productId}` },
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

  public async createMediaMetaObject(mediaAlts: string[]) {
    const { query, variables } = this.getcreateMediaMetaObjectQuery(mediaAlts)
    const response = await this.fetchGraphQL(query, variables)
    return response.metaobjectCreate
  }

  private getcreateMediaMetaObjectQuery(mediaAlts: string[]) {
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
          type: 'media',
          fields: [
            {
              key: 'alts',
              value: JSON.stringify(mediaAlts),
            },
          ],
        },
      },
    }
  }

  public async updateAltTextsMetaObject(id: string, newValues: string[]) {
    const { query, variables } = this.getUpdateAltTextsMetaObjectQuery(id, newValues)
    const response = await this.fetchGraphQL(query, variables)
    return response.metaobjectUpdate
  }

  private getUpdateAltTextsMetaObjectQuery(id: string, newValues: string[]) {
    return {
      query: `mutation UpdateMetaobject($id: ID!, $metaobject: MetaobjectUpdateInput!) {
        metaobjectUpdate(id: $id, metaobject: $metaobject) {
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
        id,
        metaobject: {
          fields: [
            {
              key: 'alts',
              value: JSON.stringify(newValues),
            },
          ],
        },
      },
    }
  }

  public async updateOption(productId: string, optionId: string, newValues: any) {
    const { query, variables } = this.getUpdateOptionQuery(productId, optionId, newValues)
    const response = await this.fetchGraphQL(query, variables)
    return response.productOptionUpdate
  }

  private getUpdateOptionQuery(productId: string, optionId: string, newValues: any) {
    return {
      query: `mutation updateOption($productId: ID!, $option: OptionUpdateInput!) {
                productOptionUpdate(productId: $productId, option: $option) {
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
                    }
                  }
                }
              }`,
      variables: {
        productId,
        option: {
          id: optionId,
          ...newValues,
        },
      },
    }
  }
}
