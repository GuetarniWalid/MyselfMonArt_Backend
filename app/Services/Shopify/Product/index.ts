import type {
  Product as ShopifyProduct,
  ProductByTag,
  ProductById,
  CreateProduct,
} from 'Types/Product'
import Authentication from '../Authentication'
import Metafield from '../Metafield'
import PaintingCopier from './Modelcopier/Painting'
import TapestryCopier from './Modelcopier/Tapestry'

export default class Product extends Authentication {
  public paintingCopier: PaintingCopier
  public tapestryCopier: TapestryCopier

  constructor() {
    super()
    this.paintingCopier = new PaintingCopier()
    this.tapestryCopier = new TapestryCopier()
  }

  public async create(product: CreateProduct) {
    const { query, variables } = this.getCreateQuery(product)
    const response = await this.fetchGraphQL(query, variables)

    if (response.productCreate.userErrors?.length) {
      throw new Error(response.productCreate.userErrors[0].message)
    }

    return response.productCreate.product as ShopifyProduct
  }

  private getCreateQuery(product: CreateProduct) {
    return {
      query: `mutation ProductCreate($product: ProductCreateInput!, $media: [CreateMediaInput!]) {
        productCreate(product: $product, media: $media) {
          product {
            id
            title
            descriptionHtml
            handle
            tags
            seo {
              title
              description
            }
            media(first: 10) {
              nodes {
                id
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
                  id
                  namespace
                  key
                  value
                  type
                }
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }`,
      variables: {
        product: {
          title: product.title,
          descriptionHtml: product.descriptionHtml,
          handle: product.handle,
          metafields:
            product.metafields?.map((metafield) => ({
              namespace: metafield.namespace,
              key: metafield.key,
              value: metafield.value,
              type: metafield.type,
            })) || [],
          seo: product.seo,
          status: 'ACTIVE',
          productType: product.productType,
          tags: product.tags,
          templateSuffix: product.templateSuffix,
        },
        media:
          product.media?.map((mediaItem) => ({
            originalSource: mediaItem.src,
            alt: mediaItem.alt,
            mediaContentType: 'IMAGE',
          })) || [],
      },
    }
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

  public async getAll(includeUnpublished: boolean = false): Promise<ShopifyProduct[]> {
    const allProducts = [] as any[]
    let cursor = null
    let hasNextPage = true

    while (hasNextPage) {
      const { query, variables } = this.getAllProductsQuery(cursor, includeUnpublished)
      const productsData = await this.fetchGraphQL(query, variables, 100) // Complex query with many fields
      const products = productsData.products.edges

      // Store the current products
      products.forEach((product) => allProducts.push(product.node))

      // Check for next page
      hasNextPage = productsData.products.pageInfo.hasNextPage

      // Get the last cursor
      if (hasNextPage) {
        cursor = products[products.length - 1].cursor
        // Add a small delay between pagination requests to prevent throttling
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    }

    return allProducts
  }

  private getAllProductsQuery(cursor: string | null = null, includeUnpublished: boolean = false) {
    const statusQuery = includeUnpublished ? '' : 'published_status:published'
    return {
      query: `query GetAllProducts($cursor: String) {
                products(first: 250, after: $cursor${statusQuery ? `, query: "${statusQuery}"` : ''}) {
                  edges {
                    node {
                      id
                      title
                      description
                      handle
                      productType
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
                      metafields(first: 250) {
                        edges {
                          node {
                            namespace
                            key
                            value
                            type
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
                      translations(locale: "en") {
                        key
                        locale
                        value
                        outdated
                        updatedAt
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

  public async getAllProductTypes(): Promise<string[]> {
    const allProducts = await this.getAll()
    const allProductTypes = allProducts.map((product) => product.productType).filter(Boolean)
    const uniqueProductTypes = [...new Set(allProductTypes)]
    return uniqueProductTypes
  }

  public async getAllTags() {
    const allProducts = await this.getAll()
    const allProductTags = allProducts.map((product) => product.tags)
    const flattenedTags = allProductTags.flat()
    const uniqueTags = [...new Set(flattenedTags)]
    return uniqueTags
  }

  public getModelCopier(product: ProductById | ShopifyProduct) {
    const isPainting = product.templateSuffix === 'painting'
    const isTapestry = product.templateSuffix === 'tapestry'

    if (isPainting) return new PaintingCopier()
    if (isTapestry) return new TapestryCopier()

    throw new Error('Invalid product type')
  }

  public async getTagsAndProductTypes(): Promise<{ tags: string[]; productTypes: string[] }> {
    const allProducts = await this.getAll()
    const tags = [...new Set(allProducts.flatMap((product) => product.tags))]
    const productTypes = [
      ...new Set(allProducts.map((product) => product.productType).filter(Boolean)),
    ]
    return { tags, productTypes }
  }

  public async getProductById(productId: string) {
    const { query, variables } = this.getProductByIdQuery(productId)
    const response = await this.fetchGraphQL(query, variables, 50) // Medium complexity query
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
              id
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
          metafields(first: 250) {
            edges {
              node {
                namespace
                key
                value
                type
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
          translations(locale: "en") {
            key
            locale
            value
            outdated
            updatedAt
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

    if (response.productUpdate.userErrors?.length) {
      throw new Error(response.productUpdate.userErrors[0].message)
    }

    return response.productUpdate.product as { id: string }
  }

  private getUpdateQuery(productId: string, newValues: any) {
    return {
      query: `mutation ProductUpdate($input: ProductInput!) {
        productUpdate(input: $input) {
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

  public async updateVariant(productId: string, variantId: string, payload: any) {
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

  /**
   * Delete media files from Shopify
   * Uses fileDelete mutation (replaces deprecated productDeleteMedia)
   * Requires: write_files access scope
   * Note: File deletion is permanent and cannot be undone
   * @param _productId - Kept for backward compatibility, not used by fileDelete
   */
  public async deleteMedia(_productId: string, mediaIds: string[]) {
    const { query, variables } = this.getDeleteMediaQuery(mediaIds)
    const response = await this.fetchGraphQL(query, variables)

    if (response.fileDelete.userErrors?.length) {
      throw new Error(response.fileDelete.userErrors[0].message)
    }

    return response.fileDelete.deletedFileIds
  }

  private getDeleteMediaQuery(mediaIds: string[]) {
    return {
      query: `mutation fileDelete($fileIds: [ID!]!) {
        fileDelete(fileIds: $fileIds) {
          deletedFileIds
          userErrors {
            field
            message
            code
          }
        }
      }`,
      variables: {
        fileIds: mediaIds,
      },
    }
  }

  /**
   * Add media to a product
   * Uses productUpdate mutation (replaces deprecated productCreateMedia)
   * Requires: write_products access scope
   * Note: Media is asynchronously uploaded and associated with the product
   * @param productId - The product ID
   * @param mediaUrl - The public URL of the image to add (not a file ID)
   * @returns All media nodes for the product (newly added media is at the end)
   */
  public async createMedia(productId: string, mediaUrl: string) {
    const { query, variables } = this.getCreateMediaQuery(productId, mediaUrl)
    const response = await this.fetchGraphQL(query, variables)

    if (response.productUpdate.userErrors?.length) {
      throw new Error(response.productUpdate.userErrors[0].message)
    }

    // Return media nodes from the updated product
    return response.productUpdate.product.media.nodes
  }

  private getCreateMediaQuery(productId: string, mediaUrl: string) {
    return {
      query: `mutation productUpdate($product: ProductUpdateInput!, $media: [CreateMediaInput!]) {
        productUpdate(product: $product, media: $media) {
          product {
            id
            media(first: 250) {
              nodes {
                id
                alt
                mediaContentType
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }`,
      variables: {
        product: {
          id: productId,
        },
        media: [
          {
            mediaContentType: 'IMAGE',
            originalSource: mediaUrl,
          },
        ],
      },
    }
  }

  public async reorderMedia(productId: string, moves: Array<{ id: string; newPosition: string }>) {
    const { query, variables } = this.getReorderMediaQuery(productId, moves)
    const response = await this.fetchGraphQL(query, variables)

    if (response.productReorderMedia.userErrors?.length) {
      throw new Error(response.productReorderMedia.userErrors[0].message)
    }

    const job = response.productReorderMedia.job

    // Wait for the reorder job to complete (it's asynchronous)
    await this.waitForJobCompletion(job.id)

    return job
  }

  /**
   * Poll Shopify to check if job is completed
   * Default: 20 attempts × 1.5s = 30 seconds max wait time
   */
  private async waitForJobCompletion(
    jobId: string,
    maxRetries: number = 20,
    delayMs: number = 1500
  ): Promise<void> {
    console.log(`⏳ Polling job completion (max ${maxRetries} attempts, ${delayMs}ms interval)`)

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const { query, variables } = this.getJobStatusQuery(jobId)
        const response = await this.fetchGraphQL(query, variables)

        // Check if job is done
        const done = response?.job?.done

        if (done === true) {
          console.log(
            `✅ Job completed successfully on attempt ${attempt} (${(attempt * delayMs) / 1000}s)`
          )
          return
        }

        console.log(`⏳ Job not complete yet, attempt ${attempt}/${maxRetries}`)
      } catch (error) {
        console.warn(`⚠️  Error checking job status on attempt ${attempt}:`, error.message)
      }

      // Wait before next retry (unless this was the last attempt)
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }
    }

    throw new Error(
      `Job completion timeout: Job not done after ${maxRetries} attempts (${(maxRetries * delayMs) / 1000}s)`
    )
  }

  private getJobStatusQuery(jobId: string) {
    return {
      query: `query GetJob($jobId: ID!) {
        job(id: $jobId) {
          id
          done
        }
      }`,
      variables: {
        jobId,
      },
    }
  }

  private getReorderMediaQuery(
    productId: string,
    moves: Array<{ id: string; newPosition: string }>
  ) {
    return {
      query: `mutation productReorderMedia($id: ID!, $moves: [MoveInput!]!) {
        productReorderMedia(id: $id, moves: $moves) {
          job {
            id
            done
          }
          userErrors {
            field
            message
          }
        }
      }`,
      variables: {
        id: productId,
        moves,
      },
    }
  }
}
