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

  public async getAll() {
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
                      images(first: 5) {
                        edges {
                          node {
                            height
                            width
                            url
                          }
                        }
                      }
                      templateSuffix
                      metafields(first: 10) {
                        edges {
                          node {
                            namespace
                            key
                            reference {
                              ... on Collection {
                                title
                              }
                            }
                          }
                        }
                      }
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
}
