import type {
  Product as ShopifyProduct,
  ProductByTag,
  ProductById,
  CreateProduct,
} from 'Types/Product'
import Authentication from '../Authentication'
import Metafield from '../Metafield'
import ArtworkCopier from './Modelcopier/Artwork'
import TapestryCopier from './Modelcopier/Tapestry'

export default class Product extends Authentication {
  public artworkCopier: ArtworkCopier
  public tapestryCopier: TapestryCopier

  constructor() {
    super()
    this.artworkCopier = new ArtworkCopier()
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

  /**
   * Poll product media status until all media are READY or FAILED
   * Shopify processes media asynchronously - this ensures images are processed before cleanup
   * @param productId - The Shopify product ID
   * @param maxAttempts - Maximum polling attempts (default: 30)
   * @param intervalMs - Interval between polls in milliseconds (default: 2000)
   * @returns Object with allReady boolean and failed media IDs array
   */
  public async waitForMediaProcessing(
    productId: string,
    maxAttempts: number = 30,
    intervalMs: number = 2000
  ): Promise<{ allReady: boolean; failedMedia: string[] }> {
    console.log(`[Shopify] Polling media status for product ${productId}...`)

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const { query, variables } = this.getMediaStatusQuery(productId)
      const response = await this.fetchGraphQL(query, variables, 50)

      const product = response.product
      if (!product || !product.media?.nodes?.length) {
        console.warn('[Shopify] Product has no media to process')
        return { allReady: true, failedMedia: [] }
      }

      const mediaStatuses = product.media.nodes.map((node) => ({
        id: node.id,
        status: node.status,
        alt: node.alt,
      }))

      const processing = mediaStatuses.filter(
        (m) => m.status === 'PROCESSING' || m.status === 'UPLOADED'
      )
      const ready = mediaStatuses.filter((m) => m.status === 'READY')
      const failed = mediaStatuses.filter((m) => m.status === 'FAILED')

      console.log(
        `[Shopify] Media status (attempt ${attempt}/${maxAttempts}): ${ready.length} ready, ${processing.length} processing, ${failed.length} failed`
      )

      // All media processed (either READY or FAILED)
      if (processing.length === 0) {
        if (failed.length > 0) {
          console.error(`[Shopify] ${failed.length} media failed to process:`)
          failed.forEach((m) => console.error(`  - ${m.id}: ${m.alt || 'no alt'}`))
        }
        return {
          allReady: failed.length === 0,
          failedMedia: failed.map((m) => m.id),
        }
      }

      // Wait before next poll
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, intervalMs))
      }
    }

    console.warn(`[Shopify] Media processing timeout after ${maxAttempts} attempts`)
    return { allReady: false, failedMedia: [] }
  }

  private getMediaStatusQuery(productId: string) {
    return {
      query: `query GetProductMediaStatus($productId: ID!) {
        product(id: $productId) {
          id
          media(first: 20) {
            nodes {
              id
              status
              alt
              mediaContentType
            }
          }
        }
      }`,
      variables: { productId },
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
      // Cost estimate: 250 products per page with nested fields (metafields, media, translations)
      // Very complex query - tune based on actual costs in logs
      const productsData = await this.fetchGraphQL(query, variables, 200)
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
                      category {
                        id
                      }
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
    const isArtwork = product.templateSuffix === 'painting' || product.templateSuffix === 'poster'
    const isTapestry = product.templateSuffix === 'tapestry'

    if (isArtwork) return new ArtworkCopier()
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
    // Cost estimate: Full product query with variants, options, metafields
    // Tune this based on actual costs in logs (watch for "Cost estimate off by X")
    const response = await this.fetchGraphQL(query, variables, 100)
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
          category {
            id
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
          altTextsMetaObject: metafield(namespace: "meta_object", key: "media") {
            id
            value
          }
          artworkTypeMetafield: metafield(namespace: "artwork", key: "type") {
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
          bundleProductsMetafield: metafield(namespace: "bundle", key: "products") {
            id
            namespace
            key
            type
            references(first: 30) {
              edges {
                node {
                  ... on Product {
                    id
                  }
                }
              }
            }
          }
          paintingLayoutMetafield: metafield(namespace: "painting", key: "layout") {
            id
            namespace
            key
            type
            reference {
              ... on Metaobject {
                id
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

  public getTagByRatio(ratio: number) {
    if (ratio > 1) return 'paysage model'
    if (ratio < 1) return 'portrait model'
    return 'square model'
  }

  public async getProductByTag(tag: string, artworkType?: 'painting' | 'poster' | 'tapestry') {
    const { query, variables } = this.getProductByTagQuery(tag)
    const response = await this.fetchGraphQL(query, variables)

    // If artworkType is provided, filter by artwork.type metafield
    if (artworkType) {
      const matchingProduct = response.products.edges.find((edge: any) => {
        const artworkTypeMetafield = edge.node.artworkTypeMetafield
        return artworkTypeMetafield?.value === artworkType
      })
      if (!matchingProduct) {
        throw new Error(`No product found with tag "${tag}" and artwork.type "${artworkType}"`)
      }
      return matchingProduct.node as ProductByTag
    }

    return response.products.edges[0].node as ProductByTag
  }

  private getProductByTagQuery(tag: string) {
    return {
      query: `query GetProductByTag {
        products(first: 10, query: "tag:${tag}") {
          edges {
            node {
              id
              artworkTypeMetafield: metafield(namespace: "artwork", key: "type") {
                value
              }
              category {
                id
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
              bundleProductsMetafield: metafield(namespace: "bundle", key: "products") {
                id
                namespace
                key
                type
                references(first: 30) {
                  edges {
                    node {
                      ... on Product {
                        id
                      }
                    }
                  }
                }
              }
              paintingLayoutMetafield: metafield(namespace: "painting", key: "layout") {
                id
                namespace
                key
                type
                reference {
                  ... on Metaobject {
                    id
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
      inventoryPolicy?: 'DENY' | 'CONTINUE'
    }>
  ) {
    const { query, variables } = this.getCreateVariantsBulkQuery(productId, variants)
    // Cost estimate: Base mutation overhead + per-variant cost
    // These are initial estimates - tune based on actual cost logs!
    // Formula: BASE + (count * PER_ITEM)
    const estimatedCost = 50 + variants.length * 2
    const response = await this.fetchGraphQL(query, variables, estimatedCost)

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
      inventoryPolicy?: 'DENY' | 'CONTINUE'
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
          // Inherit inventory policy from model, default to CONTINUE if not specified
          inventoryPolicy: variant.inventoryPolicy || 'CONTINUE',
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
   * Update multiple variant prices in a single API call
   * More efficient than updating variants individually
   */
  public async updateVariantsPricesBulk(
    productId: string,
    variants: Array<{ id: string; price: string; inventoryPolicy?: 'DENY' | 'CONTINUE' }>
  ) {
    const { query, variables } = this.getUpdateVariantsPricesBulkQuery(productId, variants)
    // Cost estimate: Base mutation overhead + per-variant cost
    // Tune based on actual cost logs! Formula: BASE + (count * PER_ITEM)
    const estimatedCost = 50 + variants.length * 2
    const response = await this.fetchGraphQL(query, variables, estimatedCost)

    if (response.productVariantsBulkUpdate.userErrors?.length) {
      throw new Error(response.productVariantsBulkUpdate.userErrors[0].message)
    }

    return response.productVariantsBulkUpdate.product
  }

  private getUpdateVariantsPricesBulkQuery(
    productId: string,
    variants: Array<{ id: string; price: string; inventoryPolicy?: 'DENY' | 'CONTINUE' }>
  ) {
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
        variants: variants.map((variant) => ({
          id: variant.id,
          price: variant.price,
          // Preserve existing inventory policy, default to CONTINUE if not specified
          inventoryPolicy: variant.inventoryPolicy || 'CONTINUE',
        })),
      },
    }
  }

  /**
   * Delete specific variants from a product
   * Uses productVariantsBulkDelete mutation with batching for large deletions
   */
  public async deleteVariants(productId: string, variantIds: string[]) {
    if (variantIds.length === 0) return

    // Shopify bulk operation limit - batch in chunks of 100
    const BATCH_SIZE = 100

    if (variantIds.length <= BATCH_SIZE) {
      // Single batch - process directly
      const { query, variables } = this.getDeleteVariantsQuery(productId, variantIds)
      const response = await this.fetchGraphQL(query, variables)

      if (response.productVariantsBulkDelete?.userErrors?.length) {
        throw new Error(response.productVariantsBulkDelete.userErrors[0].message)
      }

      return response.productVariantsBulkDelete?.product
    } else {
      // Multiple batches required
      console.info(`Deleting ${variantIds.length} variants in batches of ${BATCH_SIZE}`)

      for (let i = 0; i < variantIds.length; i += BATCH_SIZE) {
        const batch = variantIds.slice(i, i + BATCH_SIZE)
        console.info(
          `Deleting batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(variantIds.length / BATCH_SIZE)} (${batch.length} variants)`
        )

        const { query, variables } = this.getDeleteVariantsQuery(productId, batch)
        const response = await this.fetchGraphQL(query, variables)

        if (response.productVariantsBulkDelete?.userErrors?.length) {
          throw new Error(
            `Batch deletion failed: ${response.productVariantsBulkDelete.userErrors[0].message}`
          )
        }
      }

      console.info(`Successfully deleted all ${variantIds.length} variants`)
      return null // No single product to return after batched operations
    }
  }

  private getDeleteVariantsQuery(productId: string, variantIds: string[]) {
    return {
      query: `mutation productVariantsBulkDelete($productId: ID!, $variantsIds: [ID!]!) {
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
        productId,
        variantsIds: variantIds,
      },
    }
  }

  /**
   * Add new values to an existing product option
   * More efficient than recreating the entire option
   * @param option - Optional: pass existing option to avoid fetching product
   */
  public async addOptionValues(
    productId: string,
    optionId: string,
    newValues: string[],
    option?: { id: string; name: string; optionValues: { name: string }[] }
  ) {
    if (newValues.length === 0) return

    // Get option from parameter or fetch product
    let optionData = option
    if (!optionData) {
      const product = await this.getProductById(productId)
      optionData = product.options.find((opt) => opt.id === optionId)
      if (!optionData) throw new Error(`Option ${optionId} not found in product ${productId}`)
    }

    const currentValues = optionData.optionValues.map((v) => v.name)
    const updatedValues = [...currentValues, ...newValues]

    const { query, variables } = this.getUpdateOptionValuesQuery(
      productId,
      optionId,
      optionData.name,
      updatedValues,
      []
    )
    const response = await this.fetchGraphQL(query, variables)

    if (response.productOptionUpdate?.userErrors?.length) {
      throw new Error(response.productOptionUpdate.userErrors[0].message)
    }

    return response.productOptionUpdate?.product
  }

  /**
   * Remove values from an existing product option
   * More efficient than recreating the entire option
   * @param option - Optional: pass existing option to avoid fetching product
   */
  public async removeOptionValues(
    productId: string,
    optionId: string,
    valuesToRemove: string[],
    option?: { id: string; name: string; optionValues: { name: string }[] }
  ) {
    if (valuesToRemove.length === 0) return

    // Get option from parameter or fetch product
    let optionData = option
    if (!optionData) {
      const product = await this.getProductById(productId)
      optionData = product.options.find((opt) => opt.id === optionId)
      if (!optionData) throw new Error(`Option ${optionId} not found in product ${productId}`)
    }

    const currentValues = optionData.optionValues.map((v) => v.name)
    const updatedValues = currentValues.filter((v) => !valuesToRemove.includes(v))

    if (updatedValues.length === 0) {
      throw new Error(
        `Cannot remove all values from option ${optionData.name} in product ${productId}`
      )
    }

    const { query, variables } = this.getUpdateOptionValuesQuery(
      productId,
      optionId,
      optionData.name,
      updatedValues,
      []
    )
    const response = await this.fetchGraphQL(query, variables)

    if (response.productOptionUpdate?.userErrors?.length) {
      throw new Error(response.productOptionUpdate.userErrors[0].message)
    }

    return response.productOptionUpdate?.product
  }

  /**
   * Update option values directly with final state
   * Used when both adding and removing values from same option
   * Calculates diff and uses proper Shopify GraphQL format (optionValuesToAdd/Delete)
   */
  public async updateOptionValues(
    productId: string,
    optionId: string,
    optionName: string,
    finalValues: string[],
    currentValues: string[]
  ) {
    if (finalValues.length === 0) {
      throw new Error(`Cannot set option ${optionName} to have zero values in product ${productId}`)
    }

    // Calculate which values to add and delete
    const valuesToAdd = finalValues.filter((v) => !currentValues.includes(v))
    const valuesToDelete = currentValues.filter((v) => !finalValues.includes(v))

    // If no changes needed, return early
    if (valuesToAdd.length === 0 && valuesToDelete.length === 0) {
      return
    }

    // Get current option value IDs for deletion (need to fetch full product)
    const product = await this.getProductById(productId)
    const option = product.options?.find((opt) => opt.id === optionId)
    if (!option) {
      throw new Error(`Option ${optionId} not found in product ${productId}`)
    }

    const valueIdsToDelete = option.optionValues
      .filter((ov) => valuesToDelete.includes(ov.name))
      .map((ov) => ov.id)

    const { query, variables } = this.getUpdateOptionValuesQuery(
      productId,
      optionId,
      optionName,
      valuesToAdd,
      valueIdsToDelete
    )
    const response = await this.fetchGraphQL(query, variables)

    if (response.productOptionUpdate?.userErrors?.length) {
      throw new Error(response.productOptionUpdate.userErrors[0].message)
    }

    return response.productOptionUpdate?.product
  }

  private getUpdateOptionValuesQuery(
    productId: string,
    optionId: string,
    optionName: string,
    valuesToAdd: string[],
    valueIdsToDelete: string[]
  ) {
    return {
      query: `mutation productOptionUpdate(
                $productId: ID!,
                $option: OptionUpdateInput!,
                $optionValuesToAdd: [OptionValueCreateInput!],
                $optionValuesToDelete: [ID!]
              ) {
                productOptionUpdate(
                  productId: $productId,
                  option: $option,
                  optionValuesToAdd: $optionValuesToAdd,
                  optionValuesToDelete: $optionValuesToDelete
                ) {
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
        option: {
          id: optionId,
          name: optionName,
        },
        optionValuesToAdd: valuesToAdd.map((value) => ({ name: value })),
        optionValuesToDelete: valueIdsToDelete,
      },
    }
  }

  /**
   * Delete media files globally from Shopify store
   * Uses fileDelete mutation (replaces deprecated productDeleteMedia)
   * Requires: write_files access scope
   *
   * ⚠️  WARNING: This deletes files GLOBALLY from ALL products
   * If file is shared by multiple products, use detachMediaFromProduct() instead
   *
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

  public async detachMediaFromProduct(productId: string, mediaIds: string[]) {
    const { query, variables } = this.getDetachMediaQuery(productId, mediaIds)
    const response = await this.fetchGraphQL(query, variables)

    if (response.fileUpdate.userErrors?.length) {
      const errors = response.fileUpdate.userErrors
        .map((e) => `[${e.code}] ${e.field?.join('.')}: ${e.message}`)
        .join(', ')
      throw new Error(`File update errors: ${errors}`)
    }

    return response.fileUpdate.files
  }

  private getDetachMediaQuery(productId: string, mediaIds: string[]) {
    return {
      query: `mutation fileUpdate($files: [FileUpdateInput!]!) {
        fileUpdate(files: $files) {
          files {
            id
            fileStatus
            ... on MediaImage {
              id
              alt
            }
          }
          userErrors {
            field
            message
            code
          }
        }
      }`,
      variables: {
        files: mediaIds.map((mediaId) => ({
          id: mediaId,
          referencesToRemove: [productId],
        })),
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
  public async createMedia(productId: string, mediaUrl: string, alt?: string) {
    const { query, variables } = this.getCreateMediaQuery(productId, mediaUrl, alt)
    const response = await this.fetchGraphQL(query, variables)

    if (response.productUpdate.userErrors?.length) {
      throw new Error(response.productUpdate.userErrors[0].message)
    }

    // Return media nodes from the updated product
    return response.productUpdate.product.media.nodes
  }

  private getCreateMediaQuery(productId: string, mediaUrl: string, alt?: string) {
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
            ...(alt && { alt }), // Conditionally add alt if provided
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
