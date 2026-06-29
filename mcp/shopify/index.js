#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import { z } from 'zod'
import dotenv from 'dotenv'
import { ShopifyClient } from './shopify-client.js'
import express from 'express'
import { randomUUID } from 'crypto'

// Load environment variables
dotenv.config()

// Validate required environment variables for Shopify (authless mode)
const SHOPIFY_STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN
// Extract just the version (e.g., "2024-04") from formats like "admin/api/2024-04"
const rawApiVersion = process.env.SHOPIFY_API_VERSION
const SHOPIFY_API_VERSION = rawApiVersion?.replace(/^admin\/api\//, '') || undefined

if (!SHOPIFY_STORE_DOMAIN || !SHOPIFY_ACCESS_TOKEN) {
  console.error(
    'ERROR: SHOPIFY_STORE_DOMAIN and SHOPIFY_ACCESS_TOKEN environment variables are required'
  )
  process.exit(1)
}

// Create global Shopify client (authless mode - credentials from server env)
const globalShopifyClient = new ShopifyClient({
  storeDomain: SHOPIFY_STORE_DOMAIN,
  accessToken: SHOPIFY_ACCESS_TOKEN,
  apiVersion: SHOPIFY_API_VERSION,
})

console.log(`Shopify MCP Server initialized for store: ${SHOPIFY_STORE_DOMAIN}`)

// Flatten a collection's `metafields { edges { node } }` connection into a plain
// array so tool callers get `metafields: [{ namespace, key, value, type }]`.
function shapeCollection(collection) {
  if (!collection) return collection
  const shaped = { ...collection }
  if (collection.metafields && Array.isArray(collection.metafields.edges)) {
    shaped.metafields = collection.metafields.edges.map((edge) => edge.node)
  }
  return shaped
}

// Register all tools
function registerTools(server, shopifyClient) {
  // Product Tools
  server.tool(
    'listProducts',
    'List products from the Shopify store',
    {
      limit: z.number().optional().default(10),
      cursor: z.string().optional(),
      query: z.string().optional(),
      sortKey: z
        .enum([
          'TITLE',
          'PRODUCT_TYPE',
          'VENDOR',
          'CREATED_AT',
          'UPDATED_AT',
          'ID',
          'INVENTORY_TOTAL',
          'PUBLISHED_AT',
          'RELEVANCE',
        ])
        .optional(),
      reverse: z.boolean().optional().default(false),
    },
    async (args) => {
      try {
        const result = await shopifyClient.getProducts(args)
        const products = result.data.products.edges.map((edge) => edge.node)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  products,
                  pageInfo: result.data.products.pageInfo,
                },
                null,
                2
              ),
            },
          ],
        }
      } catch (error) {
        console.error('[listProducts Error]:', error)
        return {
          content: [
            {
              type: 'text',
              text: `Error fetching products: ${error.message || 'Unknown error'}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
  server.tool(
    'getProduct',
    'Get a specific product by ID',
    {
      id: z.string().describe('The product ID (e.g., gid://shopify/Product/123)'),
    },
    async (args) => {
      try {
        const result = await shopifyClient.getProduct(args.id)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.data.product, null, 2),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error fetching product: ${error.message}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
  server.tool(
    'createProduct',
    'Create a new product',
    {
      title: z.string(),
      description: z.string().optional(),
      vendor: z.string().optional(),
      productType: z.string().optional(),
      tags: z.array(z.string()).optional(),
      status: z.enum(['ACTIVE', 'DRAFT', 'ARCHIVED']).optional().default('ACTIVE'),
      variants: z
        .array(
          z.object({
            price: z.string(),
            sku: z.string().optional(),
            inventoryQuantity: z.number().optional(),
          })
        )
        .optional(),
    },
    async (args) => {
      try {
        const input = {
          title: args.title,
          descriptionHtml: args.description,
          vendor: args.vendor,
          productType: args.productType,
          tags: args.tags,
          status: args.status,
          variants: args.variants,
        }
        const result = await shopifyClient.createProduct(input)
        if (result.data.productCreate.userErrors.length > 0) {
          return {
            content: [
              {
                type: 'text',
                text: `Error creating product: ${JSON.stringify(result.data.productCreate.userErrors)}`,
              },
            ],
            isError: true,
          }
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.data.productCreate.product, null, 2),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error creating product: ${error.message}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
  server.tool(
    'updateProduct',
    'Update an existing product (title, description, tags, status, vendor, productType, templateSuffix, taxonomy category) and/or its SEO meta title/description',
    {
      id: z.string().describe('The product ID to update'),
      title: z.string().optional(),
      description: z.string().optional(),
      vendor: z.string().optional(),
      productType: z.string().optional(),
      tags: z.array(z.string()).optional(),
      status: z.enum(['ACTIVE', 'DRAFT', 'ARCHIVED']).optional(),
      templateSuffix: z
        .string()
        .optional()
        .describe(
          'Theme template suffix (e.g. "personalized" renders templates/product.personalized.json). Pass "" to reset to the default product template. Omit to leave unchanged.'
        ),
      category: z
        .string()
        .optional()
        .describe(
          'Shopify Standard Product Taxonomy category GID (e.g. gid://shopify/TaxonomyCategory/ae-2-1). Omit to leave unchanged.'
        ),
      seoTitle: z
        .string()
        .optional()
        .describe(
          'SEO meta title (the <title> tag). Pass "" to clear the override and fall back to the product title. Omit to leave unchanged.'
        ),
      seoDescription: z
        .string()
        .optional()
        .describe('SEO meta description. Pass "" to clear the override. Omit to leave unchanged.'),
    },
    async (args) => {
      try {
        const { id, seoTitle, seoDescription, ...input } = args
        if (input.description) {
          input.descriptionHtml = input.description
          delete input.description
        }
        // ProductInput.templateSuffix : "" signifie "revenir au template par défaut",
        // Shopify attend null dans ce cas
        if (input.templateSuffix === '') {
          input.templateSuffix = null
        }
        // Only build input.seo if at least one SEO field was provided, so we
        // never overwrite the existing SEO override when it's left untouched.
        if (seoTitle !== undefined || seoDescription !== undefined) {
          input.seo = {}
          if (seoTitle !== undefined) input.seo.title = seoTitle
          if (seoDescription !== undefined) input.seo.description = seoDescription
        }
        const result = await shopifyClient.updateProduct(id, input)
        if (result.data.productUpdate.userErrors.length > 0) {
          return {
            content: [
              {
                type: 'text',
                text: `Error updating product: ${JSON.stringify(result.data.productUpdate.userErrors)}`,
              },
            ],
            isError: true,
          }
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.data.productUpdate.product, null, 2),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error updating product: ${error.message}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
  server.tool(
    'createProductOptions',
    'Create product options (e.g. "Tailles", "Cadres") with their values on an existing product via productOptionsCreate. Option names and values are matched EXACTLY (case-sensitive) by the storefront picker. Default variantStrategy LEAVE_AS_IS does not touch existing variants (pair with createProductVariantsBulk to build the matrix); CREATE lets Shopify auto-generate every combination.',
    {
      productId: z.string().describe('The product ID (e.g., gid://shopify/Product/123)'),
      options: z
        .array(
          z.object({
            name: z.string().describe('Option name, exact case (e.g. "Tailles")'),
            values: z
              .array(z.string())
              .min(1)
              .describe('Option values, exact case (e.g. ["30x40 cm", "60x80 cm"])'),
          })
        )
        .min(1)
        .max(3)
        .describe('1 to 3 options (Shopify limit), in display order'),
      variantStrategy: z
        .enum(['LEAVE_AS_IS', 'CREATE'])
        .optional()
        .default('LEAVE_AS_IS')
        .describe(
          'LEAVE_AS_IS (default): variants untouched. CREATE: auto-create the full combination matrix.'
        ),
    },
    async (args) => {
      try {
        const result = await shopifyClient.createProductOptions(
          args.productId,
          args.options,
          args.variantStrategy
        )
        if (result.data.productOptionsCreate.userErrors.length > 0) {
          return {
            content: [
              {
                type: 'text',
                text: `Error creating product options: ${JSON.stringify(result.data.productOptionsCreate.userErrors)}`,
              },
            ],
            isError: true,
          }
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.data.productOptionsCreate.product, null, 2),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error creating product options: ${error.message}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
  server.tool(
    'createProductVariantsBulk',
    'Create multiple variants on a product in one call via productVariantsBulkCreate. Each variant maps option values (must already exist via createProductOptions or on the product) to a price. Use strategy REMOVE_STANDALONE_VARIANT to replace the single "Default Title" variant when populating a fresh option matrix. Inventory defaults: not tracked, policy CONTINUE (print-on-demand).',
    {
      productId: z.string().describe('The product ID (e.g., gid://shopify/Product/123)'),
      variants: z
        .array(
          z.object({
            price: z.string().describe('Variant price as a string, e.g. "34.90"'),
            compareAtPrice: z
              .string()
              .optional()
              .describe('Optional compare-at (barred) price, e.g. "49.90"'),
            optionValues: z
              .array(
                z.object({
                  optionName: z.string().describe('Option name, exact case (e.g. "Tailles")'),
                  name: z.string().describe('Option value, exact case (e.g. "30x40 cm")'),
                })
              )
              .min(1)
              .describe('One entry per product option'),
            inventoryPolicy: z
              .enum(['DENY', 'CONTINUE'])
              .optional()
              .default('CONTINUE')
              .describe('CONTINUE (default) keeps selling when out of stock'),
          })
        )
        .min(1)
        .max(100)
        .describe('1 to 100 variants per call (Shopify bulk limit)'),
      strategy: z
        .enum(['DEFAULT', 'REMOVE_STANDALONE_VARIANT'])
        .optional()
        .default('DEFAULT')
        .describe(
          'REMOVE_STANDALONE_VARIANT deletes the lone "Default Title" variant when the matrix is created'
        ),
    },
    async (args) => {
      try {
        const result = await shopifyClient.createProductVariantsBulk(
          args.productId,
          args.variants,
          args.strategy
        )
        if (result.data.productVariantsBulkCreate.userErrors.length > 0) {
          return {
            content: [
              {
                type: 'text',
                text: `Error creating product variants: ${JSON.stringify(result.data.productVariantsBulkCreate.userErrors)}`,
              },
            ],
            isError: true,
          }
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.data.productVariantsBulkCreate.productVariants, null, 2),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error creating product variants: ${error.message}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
  server.tool(
    'updateProductVariantPrices',
    'Update the price (and optionally compareAtPrice) of existing variants in a single call via productVariantsBulkUpdate. Get the variant GIDs from getProduct -> variants.',
    {
      productId: z.string().describe('The product ID (e.g., gid://shopify/Product/123)'),
      variants: z
        .array(
          z.object({
            id: z.string().describe('Variant GID (gid://shopify/ProductVariant/...)'),
            price: z.string().describe('New price as a string, e.g. "34.90"'),
            compareAtPrice: z
              .string()
              .optional()
              .describe('Optional new compare-at (barred) price. Omit to leave unchanged.'),
          })
        )
        .min(1)
        .max(100)
        .describe('1 to 100 variants per call (Shopify bulk limit)'),
    },
    async (args) => {
      try {
        const result = await shopifyClient.updateProductVariantPrices(args.productId, args.variants)
        if (result.data.productVariantsBulkUpdate.userErrors.length > 0) {
          return {
            content: [
              {
                type: 'text',
                text: `Error updating variant prices: ${JSON.stringify(result.data.productVariantsBulkUpdate.userErrors)}`,
              },
            ],
            isError: true,
          }
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.data.productVariantsBulkUpdate.productVariants, null, 2),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error updating variant prices: ${error.message}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
  // Order Tools
  server.tool(
    'listOrders',
    'List orders from the Shopify store. Returns most recent orders first by default (sortKey=CREATED_AT, reverse=true). To get the latest order, just call with limit=1.',
    {
      limit: z.number().optional().default(10).describe('Number of orders to return'),
      cursor: z.string().optional().describe('Pagination cursor for next page'),
      query: z
        .string()
        .optional()
        .describe(
          'Filter query (NOT for sorting). Examples: "created_at:>2025-01-01", "email:john@example.com", "financial_status:paid". Use sortKey/reverse for sorting.'
        ),
      status: z.enum(['open', 'closed', 'cancelled', 'any']).optional(),
      financialStatus: z
        .enum(['paid', 'pending', 'refunded', 'partially_refunded', 'any'])
        .optional(),
      fulfillmentStatus: z.enum(['shipped', 'partial', 'unshipped', 'any']).optional(),
      sortKey: z
        .enum([
          'CREATED_AT',
          'CUSTOMER_NAME',
          'DESTINATION',
          'FINANCIAL_STATUS',
          'FULFILLMENT_STATUS',
          'ID',
          'ORDER_NUMBER',
          'PO_NUMBER',
          'PROCESSED_AT',
          'RELEVANCE',
          'TOTAL_ITEMS_QUANTITY',
          'TOTAL_PRICE',
          'UPDATED_AT',
        ])
        .optional()
        .default('CREATED_AT')
        .describe('Field to sort orders by (default: CREATED_AT)'),
      reverse: z
        .boolean()
        .optional()
        .default(true)
        .describe(
          'Sort direction: true = newest/highest first (default), false = oldest/lowest first'
        ),
    },
    async (args) => {
      try {
        const result = await shopifyClient.getOrders(args)
        const orders = result.data.orders.edges.map((edge) => edge.node)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  orders,
                  pageInfo: result.data.orders.pageInfo,
                },
                null,
                2
              ),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error fetching orders: ${error.message}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
  server.tool(
    'getOrder',
    'Get a specific order by ID',
    {
      id: z.string().describe('The order ID (e.g., gid://shopify/Order/123)'),
    },
    async (args) => {
      try {
        const result = await shopifyClient.getOrder(args.id)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.data.order, null, 2),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error fetching order: ${error.message}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
  // Customer Tools
  server.tool(
    'listCustomers',
    'List customers from the Shopify store',
    {
      limit: z.number().optional().default(10),
      cursor: z.string().optional(),
      query: z.string().optional(),
      sortKey: z
        .enum(['NAME', 'CREATED_AT', 'UPDATED_AT', 'ID', 'LOCATION', 'RELEVANCE'])
        .optional(),
      reverse: z.boolean().optional().default(false),
    },
    async (args) => {
      try {
        const result = await shopifyClient.getCustomers(args)
        const customers = result.data.customers.edges.map((edge) => edge.node)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  customers,
                  pageInfo: result.data.customers.pageInfo,
                },
                null,
                2
              ),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error fetching customers: ${error.message}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
  server.tool(
    'getCustomer',
    'Get a specific customer by ID',
    {
      id: z.string().describe('The customer ID (e.g., gid://shopify/Customer/123)'),
    },
    async (args) => {
      try {
        const result = await shopifyClient.getCustomer(args.id)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.data.customer, null, 2),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error fetching customer: ${error.message}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
  // Inventory Tools
  server.tool(
    'getInventoryLevels',
    'Get inventory levels for a product variant',
    {
      inventoryItemId: z.string().describe('The inventory item ID'),
    },
    async (args) => {
      try {
        const result = await shopifyClient.getInventoryLevels(args.inventoryItemId)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.data.inventoryItem, null, 2),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error fetching inventory levels: ${error.message}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
  server.tool(
    'adjustInventory',
    'Adjust inventory quantity',
    {
      inventoryItemId: z.string(),
      locationId: z.string(),
      quantity: z.number(),
    },
    async (args) => {
      try {
        const result = await shopifyClient.adjustInventory(
          args.inventoryItemId,
          args.locationId,
          args.quantity
        )
        if (result.data.inventoryAdjustQuantities.userErrors.length > 0) {
          return {
            content: [
              {
                type: 'text',
                text: `Error adjusting inventory: ${JSON.stringify(result.data.inventoryAdjustQuantities.userErrors)}`,
              },
            ],
            isError: true,
          }
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                result.data.inventoryAdjustQuantities.inventoryAdjustmentGroup,
                null,
                2
              ),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error adjusting inventory: ${error.message}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
  // Metafield Tools
  server.tool(
    'setMetafield',
    'Set a metafield on a resource',
    {
      ownerId: z.string().describe('The ID of the resource to attach the metafield to'),
      namespace: z.string(),
      key: z.string(),
      value: z.string(),
      type: z.string().optional().default('single_line_text_field'),
    },
    async (args) => {
      try {
        const result = await shopifyClient.setMetafield(args.ownerId, {
          namespace: args.namespace,
          key: args.key,
          value: args.value,
          type: args.type,
        })
        if (result.data.metafieldsSet.userErrors.length > 0) {
          return {
            content: [
              {
                type: 'text',
                text: `Error setting metafield: ${JSON.stringify(result.data.metafieldsSet.userErrors)}`,
              },
            ],
            isError: true,
          }
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.data.metafieldsSet.metafields, null, 2),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error setting metafield: ${error.message}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
  // Collection Tools
  server.tool(
    'listCollections',
    'List collections from the Shopify store',
    {
      limit: z.number().optional().default(10),
      cursor: z.string().optional(),
      query: z.string().optional(),
    },
    async (args) => {
      try {
        const result = await shopifyClient.getCollections(args)
        const collections = result.data.collections.edges.map((edge) => edge.node)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  collections,
                  pageInfo: result.data.collections.pageInfo,
                },
                null,
                2
              ),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error fetching collections: ${error.message}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
  server.tool(
    'createCollection',
    'Create a collection from scratch (collectionCreate) — the full SEO/editorial shell in ONE call: title (= storefront H1), handle, descriptionHtml, SEO meta, a representative image (by public URL), template suffix, editorial metafields (e.g. custom.intro / custom.guide / custom.faq), and an optional smart `ruleSet` (auto-populated by tag). ' +
      'The collection is created UNPUBLISHED by default so empty pages are never indexed; pass published:true to publish it on the Online Store. ' +
      'Returns the created collection (id, handle, …) and its publication status; userErrors are surfaced as-is.',
    {
      title: z.string().describe('Collection title — this is also the H1 on the collection page'),
      handle: z
        .string()
        .optional()
        .describe('URL handle/slug. Auto-generated from the title if omitted.'),
      descriptionHtml: z
        .string()
        .optional()
        .describe('Collection body/description (HTML allowed) — maps to body_html'),
      seo: z
        .object({
          title: z.string().optional().describe('SEO meta title (the <title> tag)'),
          description: z.string().optional().describe('SEO meta description'),
        })
        .optional()
        .describe('SEO meta title/description override'),
      image: z
        .object({
          src: z
            .string()
            .describe('Publicly accessible image URL (or a staged-upload URL from uploadFile)'),
          altText: z.string().optional().describe('Accessibility / SEO alt text'),
        })
        .optional()
        .describe('Representative collection image'),
      templateSuffix: z
        .string()
        .optional()
        .describe(
          'Theme template suffix (e.g. "editorial" renders templates/collection.editorial.json). Omit for the default collection template.'
        ),
      published: z
        .boolean()
        .optional()
        .default(false)
        .describe(
          'FALSE by default — do NOT publish at creation (empty pages must not be indexed). TRUE publishes the collection on the Online Store publication (requires the write_publications scope).'
        ),
      ruleSet: z
        .object({
          appliedDisjunctively: z
            .boolean()
            .describe('true = product matches ANY rule (OR); false = must match ALL rules (AND)'),
          rules: z
            .array(
              z.object({
                column: z
                  .string()
                  .describe(
                    'Rule column, e.g. TAG, TYPE, VENDOR, TITLE, VARIANT_PRICE, IS_PRICE_REDUCED'
                  ),
                relation: z
                  .string()
                  .describe(
                    'Relation, e.g. EQUALS, NOT_EQUALS, CONTAINS, STARTS_WITH, ENDS_WITH, GREATER_THAN, LESS_THAN'
                  ),
                condition: z.string().describe('Value to match, e.g. a tag name like "poster"'),
              })
            )
            .min(1),
        })
        .optional()
        .describe('Makes this a SMART (auto-populated) collection. Omit for a manual collection.'),
      metafields: z
        .array(
          z.object({
            namespace: z.string(),
            key: z.string(),
            type: z
              .string()
              .describe(
                'Shopify metafield type, e.g. multi_line_text_field, single_line_text_field, rich_text_field, json'
              ),
            value: z.string(),
          })
        )
        .optional()
        .describe(
          'Editorial metafields to set in the same call, e.g. custom.intro / custom.guide / custom.faq'
        ),
    },
    async (args) => {
      try {
        const { published, ...input } = args
        const result = await shopifyClient.createCollection(input)
        const payload = result.data.collectionCreate
        if (payload.userErrors.length > 0) {
          return {
            content: [
              {
                type: 'text',
                text: `Error creating collection: ${JSON.stringify(payload.userErrors)}`,
              },
            ],
            isError: true,
          }
        }
        const collection = payload.collection
        // Created UNPUBLISHED by default (Shopify behaviour). Only publish when asked.
        let publication = { publishedOnOnlineStore: false }
        if (published) {
          try {
            const pub = await shopifyClient.setCollectionPublished(collection.id, true)
            const p = pub.data.publishablePublish
            publication =
              p.userErrors && p.userErrors.length > 0
                ? { publishedOnOnlineStore: false, userErrors: p.userErrors }
                : { publishedOnOnlineStore: p.publishable?.publishedOnPublication ?? true }
          } catch (e) {
            // The collection was created; surface the publish failure without losing it.
            publication = { publishedOnOnlineStore: false, error: e.message }
          }
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                { collection: shapeCollection(collection), publication },
                null,
                2
              ),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error creating collection: ${error.message}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
  server.tool(
    'getCollection',
    'Read a collection by `id` OR `handle`. Returns id, handle, title, descriptionHtml, templateSuffix, sortOrder, seo, image, ruleSet, whether it is published on the Online Store (publishedOnOnlineStore), and its metafields (all namespaces, incl. custom & global). Use it for idempotence — check whether a handle already exists before createCollection, or to verify metafields after a write.',
    {
      id: z
        .string()
        .optional()
        .describe('Collection GID (e.g. gid://shopify/Collection/123). Provide id OR handle.'),
      handle: z
        .string()
        .optional()
        .describe('Collection handle/slug (e.g. "test-poster-zzz"). Provide id OR handle.'),
    },
    async (args) => {
      try {
        if (!args.id && !args.handle) {
          return {
            content: [{ type: 'text', text: 'Provide either `id` or `handle`.' }],
            isError: true,
          }
        }
        const collection = await shopifyClient.getCollection(args)
        if (!collection) {
          return {
            content: [
              {
                type: 'text',
                text: `Collection not found for ${args.id ? `id ${args.id}` : `handle "${args.handle}"`}.`,
              },
            ],
            isError: true,
          }
        }
        return {
          content: [{ type: 'text', text: JSON.stringify(shapeCollection(collection), null, 2) }],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error fetching collection: ${error.message}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
  server.tool(
    'updateCollection',
    'Update an existing collection: title (= storefront H1), description, handle/URL, SEO meta, representative image, templateSuffix, editorial metafields, and/or publish/unpublish it on the Online Store (`published`). Only the fields you pass are changed.',
    {
      id: z.string().describe('The collection ID to update (e.g. gid://shopify/Collection/123)'),
      title: z
        .string()
        .optional()
        .describe('Collection title — this is also the H1 on the collection page'),
      description: z.string().optional().describe('Collection description (HTML allowed)'),
      handle: z.string().optional().describe('URL handle/slug of the collection'),
      seoTitle: z.string().optional().describe('SEO meta title'),
      seoDescription: z.string().optional().describe('SEO meta description'),
      image: z
        .object({
          src: z
            .string()
            .describe('Publicly accessible image URL (or a staged-upload URL from uploadFile)'),
          altText: z.string().optional().describe('Accessibility / SEO alt text'),
        })
        .optional()
        .describe('Replace the representative collection image'),
      templateSuffix: z
        .string()
        .optional()
        .describe(
          'Theme template suffix. Pass "" to reset to the default collection template. Omit to leave unchanged.'
        ),
      metafields: z
        .array(
          z.object({
            namespace: z.string(),
            key: z.string(),
            type: z
              .string()
              .describe(
                'Shopify metafield type, e.g. multi_line_text_field, rich_text_field, json'
              ),
            value: z.string(),
          })
        )
        .optional()
        .describe(
          'Editorial metafields to set/overwrite, e.g. custom.intro / custom.guide / custom.faq'
        ),
      published: z
        .boolean()
        .optional()
        .describe(
          'Publish (true) or unpublish (false) the collection on the Online Store publication. Omit to leave the publication state unchanged. Requires the write_publications scope.'
        ),
    },
    async (args) => {
      try {
        const { id, description, seoTitle, seoDescription, published, templateSuffix, ...rest } =
          args
        const input = { ...rest }
        if (description !== undefined) {
          input.descriptionHtml = description
        }
        // "" means "reset to the default collection template" → Shopify expects null.
        if (templateSuffix !== undefined) {
          input.templateSuffix = templateSuffix === '' ? null : templateSuffix
        }
        if (seoTitle !== undefined || seoDescription !== undefined) {
          input.seo = {}
          if (seoTitle !== undefined) input.seo.title = seoTitle
          if (seoDescription !== undefined) input.seo.description = seoDescription
        }
        let collection = null
        if (Object.keys(input).length > 0) {
          const result = await shopifyClient.updateCollection(id, input)
          const payload = result.data.collectionUpdate
          if (payload.userErrors.length > 0) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Error updating collection: ${JSON.stringify(payload.userErrors)}`,
                },
              ],
              isError: true,
            }
          }
          collection = payload.collection
        }
        let publication
        if (published !== undefined) {
          try {
            const pub = await shopifyClient.setCollectionPublished(id, published)
            const p = published ? pub.data.publishablePublish : pub.data.publishableUnpublish
            publication =
              p.userErrors && p.userErrors.length > 0
                ? { published, userErrors: p.userErrors }
                : { publishedOnOnlineStore: p.publishable?.publishedOnPublication ?? published }
          } catch (e) {
            publication = { published, error: e.message }
          }
        }
        if (!collection && publication === undefined) {
          return {
            content: [
              {
                type: 'text',
                text: 'Nothing to update: pass at least one field to change (title, description, handle, seoTitle, seoDescription, image, templateSuffix, metafields) or `published`.',
              },
            ],
            isError: true,
          }
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                { collection: collection ? shapeCollection(collection) : undefined, publication },
                null,
                2
              ),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error updating collection: ${error.message}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
  server.tool(
    'deleteCollection',
    'Delete a collection by id (collectionDelete). IRREVERSIBLE — use for cleanup/rollback of a shell you created. Returns the deleted collection id.',
    {
      id: z.string().describe('The collection ID to delete (e.g. gid://shopify/Collection/123)'),
    },
    async (args) => {
      try {
        const result = await shopifyClient.deleteCollection(args.id)
        const payload = result.data.collectionDelete
        if (payload.userErrors.length > 0) {
          return {
            content: [
              {
                type: 'text',
                text: `Error deleting collection: ${JSON.stringify(payload.userErrors)}`,
              },
            ],
            isError: true,
          }
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ deletedCollectionId: payload.deletedCollectionId }, null, 2),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error deleting collection: ${error.message}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
  // Location Tools
  server.tool('listLocations', 'List all store locations', async () => {
    try {
      const result = await shopifyClient.getLocations()
      const locations = result.data.locations.edges.map((edge) => edge.node)
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(locations, null, 2),
          },
        ],
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error fetching locations: ${error.message}`,
          },
        ],
        isError: true,
      }
    }
  })
  // Publication (sales channel) Tools
  server.tool(
    'listPublications',
    'List all sales channels (publications) installed on the store. Use this to verify which channels (e.g., "Facebook & Instagram", "Online Store", "Pinterest") are connected, including the underlying Meta/Shopify app for each.',
    {
      limit: z.number().optional().default(50),
      cursor: z.string().optional(),
    },
    async (args) => {
      try {
        const result = await shopifyClient.getPublications(args)
        const publications = result.data.publications.edges.map((edge) => edge.node)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  publications,
                  pageInfo: result.data.publications.pageInfo,
                },
                null,
                2
              ),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error fetching publications: ${error.message}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
  server.tool(
    'getProductPublications',
    'List the sales channels (publications) a specific product is published on. Useful to verify that a product is synced to Facebook & Instagram, Pinterest, or any other channel.',
    {
      productId: z.string().describe('The product ID (e.g., gid://shopify/Product/123)'),
      limit: z.number().optional().default(50),
      onlyPublished: z
        .boolean()
        .optional()
        .default(false)
        .describe('If true, only return channels where the product is currently published'),
    },
    async (args) => {
      try {
        const result = await shopifyClient.getProductPublications(args.productId, {
          limit: args.limit,
          onlyPublished: args.onlyPublished,
        })
        if (!result.data.product) {
          return {
            content: [
              {
                type: 'text',
                text: `Product not found: ${args.productId}`,
              },
            ],
            isError: true,
          }
        }
        const publications = result.data.product.resourcePublicationsV2.edges.map(
          (edge) => edge.node
        )
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  product: {
                    id: result.data.product.id,
                    title: result.data.product.title,
                    handle: result.data.product.handle,
                  },
                  publications,
                  pageInfo: result.data.product.resourcePublicationsV2.pageInfo,
                },
                null,
                2
              ),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error fetching product publications: ${error.message}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
  // Analytics Tools
  server.tool('getShopInfo', 'Get shop information and analytics', async () => {
    try {
      const result = await shopifyClient.getShopAnalytics()
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result.data.shop, null, 2),
          },
        ],
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error fetching shop info: ${error.message}`,
          },
        ],
        isError: true,
      }
    }
  })
  // Discount Tools
  server.tool(
    'listDiscounts',
    'List discount codes and automatic discounts',
    {
      limit: z.number().optional().default(10),
      cursor: z.string().optional(),
      query: z.string().optional(),
      savedSearchId: z.string().optional(),
    },
    async (args) => {
      try {
        const result = await shopifyClient.getDiscounts(args)
        const discounts = result.data.discountNodes.edges.map((edge) => edge.node)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  discounts,
                  pageInfo: result.data.discountNodes.pageInfo,
                },
                null,
                2
              ),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error fetching discounts: ${error.message}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
  server.tool(
    'createDiscountCode',
    'Create a discount code',
    {
      title: z.string(),
      code: z.string(),
      startsAt: z.string().optional(),
      endsAt: z.string().optional(),
      usageLimit: z.number().optional(),
      appliesOncePerCustomer: z.boolean().optional(),
      minimumRequirement: z
        .object({
          quantity: z.number().optional(),
          subtotal: z.string().optional(),
        })
        .optional(),
      customerGets: z.object({
        value: z.object({
          percentage: z.number().optional(),
          amount: z.string().optional(),
        }),
        items: z.enum(['all', 'products', 'collections']).optional(),
      }),
      customerSelection: z.enum(['all', 'customer_segments']).optional().default('all'),
    },
    async (args) => {
      try {
        const result = await shopifyClient.createDiscountCode(args)
        if (result.data.discountCodeBasicCreate.userErrors.length > 0) {
          return {
            content: [
              {
                type: 'text',
                text: `Error creating discount: ${JSON.stringify(result.data.discountCodeBasicCreate.userErrors)}`,
              },
            ],
            isError: true,
          }
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.data.discountCodeBasicCreate.codeDiscountNode, null, 2),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error creating discount: ${error.message}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
  // Fulfillment Tools
  server.tool(
    'listFulfillmentOrders',
    'List fulfillment orders',
    {
      limit: z.number().optional().default(10),
      cursor: z.string().optional(),
      status: z.enum(['open', 'in_progress', 'cancelled', 'incomplete', 'closed']).optional(),
      assignedLocationId: z.string().optional(),
    },
    async (args) => {
      try {
        const result = await shopifyClient.getFulfillmentOrders(args)
        const fulfillmentOrders = result.data.shop.fulfillmentOrders.edges.map((edge) => edge.node)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  fulfillmentOrders,
                  pageInfo: result.data.shop.fulfillmentOrders.pageInfo,
                },
                null,
                2
              ),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error fetching fulfillment orders: ${error.message}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
  server.tool(
    'createFulfillment',
    'Create a fulfillment for an order',
    {
      orderId: z.string().describe('The order ID to fulfill'),
      lineItems: z.array(
        z.object({
          id: z.string(),
          quantity: z.number(),
        })
      ),
      trackingInfo: z
        .object({
          number: z.string().optional(),
          url: z.string().optional(),
          company: z.string().optional(),
        })
        .optional(),
      notifyCustomer: z.boolean().optional().default(true),
      locationId: z.string().optional(),
    },
    async (args) => {
      try {
        const result = await shopifyClient.createFulfillment(args)
        // Use fulfillmentCreate response (updated from deprecated fulfillmentCreateV2)
        if (result.data.fulfillmentCreate.userErrors.length > 0) {
          return {
            content: [
              {
                type: 'text',
                text: `Error creating fulfillment: ${JSON.stringify(result.data.fulfillmentCreate.userErrors)}`,
              },
            ],
            isError: true,
          }
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.data.fulfillmentCreate.fulfillment, null, 2),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error creating fulfillment: ${error.message}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
  // Shipping Tools
  server.tool(
    'getShippingZones',
    'Get shipping zones and rates',
    {
      limit: z.number().optional().default(10),
    },
    async (args) => {
      try {
        const result = await shopifyClient.getShippingZones(args)
        const zones = result.data.deliveryProfiles.edges[0].node.profileLocationGroups
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(zones, null, 2),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error fetching shipping zones: ${error.message}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
  // Financial Tools
  server.tool(
    'listTransactions',
    'List transactions for an order',
    {
      orderId: z.string().describe('The order ID'),
    },
    async (args) => {
      try {
        const result = await shopifyClient.getOrderTransactions(args.orderId)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.data.order.transactions, null, 2),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error fetching transactions: ${error.message}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
  server.tool(
    'createRefund',
    'Create a refund for an order',
    {
      orderId: z.string().describe('The order ID to refund'),
      lineItems: z
        .array(
          z.object({
            lineItemId: z.string(),
            quantity: z.number(),
            restockType: z.enum(['NO_RESTOCK', 'RETURN', 'CANCEL']).optional(),
          })
        )
        .optional(),
      shipping: z
        .object({
          amount: z.string(),
          fullRefund: z.boolean().optional(),
        })
        .optional(),
      refundDuties: z.boolean().optional(),
      note: z.string().optional(),
      notify: z.boolean().optional().default(true),
    },
    async (args) => {
      try {
        const result = await shopifyClient.createRefund(args)
        if (result.data.refundCreate.userErrors.length > 0) {
          return {
            content: [
              {
                type: 'text',
                text: `Error creating refund: ${JSON.stringify(result.data.refundCreate.userErrors)}`,
              },
            ],
            isError: true,
          }
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.data.refundCreate.refund, null, 2),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error creating refund: ${error.message}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
  // Gift Card Tools
  server.tool(
    'listGiftCards',
    'List gift cards',
    {
      limit: z.number().optional().default(10),
      cursor: z.string().optional(),
      query: z.string().optional(),
    },
    async (args) => {
      try {
        const result = await shopifyClient.getGiftCards(args)
        const giftCards = result.data.giftCards.edges.map((edge) => edge.node)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  giftCards,
                  pageInfo: result.data.giftCards.pageInfo,
                },
                null,
                2
              ),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error fetching gift cards: ${error.message}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
  server.tool(
    'createGiftCard',
    'Create a gift card',
    {
      initialValue: z.string().describe('The initial value (e.g., "100.00")'),
      code: z.string().optional(),
      note: z.string().optional(),
      expiresOn: z.string().optional(),
      recipientEmail: z.string().optional(),
      recipientMessage: z.string().optional(),
    },
    async (args) => {
      try {
        const result = await shopifyClient.createGiftCard(args)
        if (result.data.giftCardCreate.userErrors.length > 0) {
          return {
            content: [
              {
                type: 'text',
                text: `Error creating gift card: ${JSON.stringify(result.data.giftCardCreate.userErrors)}`,
              },
            ],
            isError: true,
          }
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.data.giftCardCreate.giftCard, null, 2),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error creating gift card: ${error.message}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
  // Content & Marketing Tools
  server.tool(
    'listPages',
    'List store pages',
    {
      limit: z.number().optional().default(10),
      cursor: z.string().optional(),
    },
    async (args) => {
      try {
        const result = await shopifyClient.getPages(args)
        const pages = result.data.pages.edges.map((edge) => edge.node)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  pages,
                  pageInfo: result.data.pages.pageInfo,
                },
                null,
                2
              ),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error fetching pages: ${error.message}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
  server.tool(
    'createPage',
    'Create a new page',
    {
      title: z.string(),
      content: z.string(),
      handle: z.string().optional(),
      published: z.boolean().optional().default(true),
      metafields: z
        .array(
          z.object({
            namespace: z.string(),
            key: z.string(),
            value: z.string(),
            type: z.string(),
          })
        )
        .optional(),
    },
    async (args) => {
      try {
        const result = await shopifyClient.createPage(args)
        if (result.data.pageCreate.userErrors.length > 0) {
          return {
            content: [
              {
                type: 'text',
                text: `Error creating page: ${JSON.stringify(result.data.pageCreate.userErrors)}`,
              },
            ],
            isError: true,
          }
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.data.pageCreate.page, null, 2),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error creating page: ${error.message}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
  server.tool(
    'listBlogs',
    'List blogs',
    {
      limit: z.number().optional().default(10),
      cursor: z.string().optional(),
    },
    async (args) => {
      try {
        const result = await shopifyClient.getBlogs(args)
        const blogs = result.data.blogs.edges.map((edge) => edge.node)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  blogs,
                  pageInfo: result.data.blogs.pageInfo,
                },
                null,
                2
              ),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error fetching blogs: ${error.message}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
  server.tool(
    'createArticle',
    'Create a blog article',
    {
      blogId: z.string().describe('The blog ID'),
      title: z.string(),
      content: z.string(),
      summary: z.string().optional(),
      tags: z.array(z.string()).optional(),
      published: z.boolean().optional().default(true),
      publishedAt: z.string().optional(),
      image: z
        .object({
          url: z.string(),
          altText: z.string().optional(),
        })
        .optional(),
    },
    async (args) => {
      try {
        const result = await shopifyClient.createArticle(args)
        if (result.data.articleCreate.userErrors.length > 0) {
          return {
            content: [
              {
                type: 'text',
                text: `Error creating article: ${JSON.stringify(result.data.articleCreate.userErrors)}`,
              },
            ],
            isError: true,
          }
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.data.articleCreate.article, null, 2),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error creating article: ${error.message}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
  server.tool(
    'createRedirect',
    'Create a URL redirect',
    {
      path: z.string().describe('The old path to redirect from'),
      target: z.string().describe('The new path or URL to redirect to'),
    },
    async (args) => {
      try {
        const result = await shopifyClient.createRedirect(args)
        if (result.data.urlRedirectCreate.userErrors.length > 0) {
          return {
            content: [
              {
                type: 'text',
                text: `Error creating redirect: ${JSON.stringify(result.data.urlRedirectCreate.userErrors)}`,
              },
            ],
            isError: true,
          }
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.data.urlRedirectCreate.urlRedirect, null, 2),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error creating redirect: ${error.message}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
  // Theme Tools
  server.tool('listThemes', 'List installed themes', async () => {
    try {
      const result = await shopifyClient.getThemes()
      const themes = result.data.themes.edges.map((edge) => edge.node)
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(themes, null, 2),
          },
        ],
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error fetching themes: ${error.message}`,
          },
        ],
        isError: true,
      }
    }
  })
  // Webhook Tools
  server.tool(
    'listWebhooks',
    'List configured webhooks',
    {
      limit: z.number().optional().default(10),
      cursor: z.string().optional(),
    },
    async (args) => {
      try {
        const result = await shopifyClient.getWebhooks(args)
        const webhooks = result.data.webhookSubscriptions.edges.map((edge) => edge.node)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  webhooks,
                  pageInfo: result.data.webhookSubscriptions.pageInfo,
                },
                null,
                2
              ),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error fetching webhooks: ${error.message}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
  server.tool(
    'createWebhook',
    'Create a webhook subscription',
    {
      topic: z.string().describe('The webhook topic (e.g., ORDERS_CREATE)'),
      callbackUrl: z.string().describe('The URL to receive webhook notifications'),
      format: z.enum(['JSON', 'XML']).optional().default('JSON'),
      includeFields: z.array(z.string()).optional(),
    },
    async (args) => {
      try {
        const result = await shopifyClient.createWebhook(args)
        if (result.data.webhookSubscriptionCreate.userErrors.length > 0) {
          return {
            content: [
              {
                type: 'text',
                text: `Error creating webhook: ${JSON.stringify(result.data.webhookSubscriptionCreate.userErrors)}`,
              },
            ],
            isError: true,
          }
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                result.data.webhookSubscriptionCreate.webhookSubscription,
                null,
                2
              ),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error creating webhook: ${error.message}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
  // Draft Order Tools
  server.tool(
    'listDraftOrders',
    'List draft orders',
    {
      limit: z.number().optional().default(10),
      cursor: z.string().optional(),
      query: z.string().optional(),
    },
    async (args) => {
      try {
        const result = await shopifyClient.getDraftOrders(args)
        const draftOrders = result.data.draftOrders.edges.map((edge) => edge.node)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  draftOrders,
                  pageInfo: result.data.draftOrders.pageInfo,
                },
                null,
                2
              ),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error fetching draft orders: ${error.message}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
  server.tool(
    'createDraftOrder',
    'Create a draft order',
    {
      lineItems: z.array(
        z.object({
          variantId: z.string().optional(),
          productId: z.string().optional(),
          quantity: z.number(),
          customAttributes: z
            .array(
              z.object({
                key: z.string(),
                value: z.string(),
              })
            )
            .optional(),
        })
      ),
      customerId: z.string().optional(),
      email: z.string().optional(),
      note: z.string().optional(),
      tags: z.array(z.string()).optional(),
      shippingAddress: z
        .object({
          address1: z.string(),
          address2: z.string().optional(),
          city: z.string(),
          provinceCode: z.string().optional(),
          countryCode: z.string(),
          zip: z.string(),
        })
        .optional(),
      billingAddress: z
        .object({
          address1: z.string(),
          address2: z.string().optional(),
          city: z.string(),
          provinceCode: z.string().optional(),
          countryCode: z.string(),
          zip: z.string(),
        })
        .optional(),
    },
    async (args) => {
      try {
        const result = await shopifyClient.createDraftOrder(args)
        if (result.data.draftOrderCreate.userErrors.length > 0) {
          return {
            content: [
              {
                type: 'text',
                text: `Error creating draft order: ${JSON.stringify(result.data.draftOrderCreate.userErrors)}`,
              },
            ],
            isError: true,
          }
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.data.draftOrderCreate.draftOrder, null, 2),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error creating draft order: ${error.message}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
  // Metaobject Tools (GraphQL exclusive)
  server.tool(
    'listMetaobjects',
    'List metaobject INSTANCES of a given type (the records, not the schema — use listMetaobjectDefinitions for the field model).',
    {
      type: z.string().describe('The metaobject type'),
      limit: z.number().optional().default(10),
      cursor: z.string().optional(),
    },
    async (args) => {
      try {
        const result = await shopifyClient.getMetaobjects(args)
        const metaobjects = result.data.metaobjects.edges.map((edge) => edge.node)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  metaobjects,
                  pageInfo: result.data.metaobjects.pageInfo,
                },
                null,
                2
              ),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error fetching metaobjects: ${error.message}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
  server.tool(
    'createMetaobject',
    'Create a metaobject INSTANCE (a record whose `type` definition must already exist). If the type has no definition yet, create it first with createMetaobjectDefinition; use listMetaobjectDefinitions / getMetaobjectDefinition to discover the exact field keys.',
    {
      type: z.string().describe('The metaobject type'),
      fields: z.array(
        z.object({
          key: z.string(),
          value: z.string(),
        })
      ),
    },
    async (args) => {
      try {
        const result = await shopifyClient.createMetaobject(args)
        if (result.data.metaobjectCreate.userErrors.length > 0) {
          return {
            content: [
              {
                type: 'text',
                text: `Error creating metaobject: ${JSON.stringify(result.data.metaobjectCreate.userErrors)}`,
              },
            ],
            isError: true,
          }
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.data.metaobjectCreate.metaobject, null, 2),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error creating metaobject: ${error.message}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
  // Metaobject DEFINITION Tools (the field schema / "model" behind each metaobject type)
  server.tool(
    'listMetaobjectDefinitions',
    'List metaobject DEFINITIONS (the schemas/models): each type, its field keys/types, and the number of instances. Check this before createMetaobjectDefinition (duplicate types error) or to discover the field keys needed by createMetaobject.',
    {
      limit: z.number().optional().default(50),
      cursor: z.string().optional(),
    },
    async (args) => {
      try {
        const result = await shopifyClient.getMetaobjectDefinitions(args)
        const definitions = result.data.metaobjectDefinitions.edges.map((edge) => edge.node)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  definitions,
                  pageInfo: result.data.metaobjectDefinitions.pageInfo,
                },
                null,
                2
              ),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error fetching metaobject definitions: ${error.message}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
  server.tool(
    'getMetaobjectDefinition',
    'Get a single metaobject DEFINITION by its type, including the full field schema (keys, names, field types, required flags, validations). Use it to learn the exact field keys before calling createMetaobject.',
    {
      type: z.string().describe('The metaobject definition type (e.g. "color_swatch")'),
    },
    async (args) => {
      try {
        const result = await shopifyClient.getMetaobjectDefinitionByType(args.type)
        if (!result.data.metaobjectDefinitionByType) {
          return {
            content: [
              {
                type: 'text',
                text: `No metaobject definition found for type "${args.type}". Create it with createMetaobjectDefinition.`,
              },
            ],
            isError: true,
          }
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.data.metaobjectDefinitionByType, null, 2),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error fetching metaobject definition: ${error.message}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
  server.tool(
    'createMetaobjectDefinition',
    'Create a metaobject DEFINITION — the field schema / "model" that must exist before createMetaobject can add instances of that type (maps to metaobjectDefinitionCreate). The `type` is a permanent unique identifier (e.g. "color_swatch"); each field has a key, a name and a Shopify field type. Common field types: single_line_text_field, multi_line_text_field, number_integer, number_decimal, boolean, color, url, date, date_time, json, rich_text_field, dimension, money, file_reference, product_reference, collection_reference, metaobject_reference, and their list.* variants (e.g. list.single_line_text_field).',
    {
      type: z
        .string()
        .describe(
          'Permanent unique type identifier (e.g. "color_swatch"). Cannot be changed later.'
        ),
      name: z.string().describe('Human-readable display name (e.g. "Color swatch")'),
      description: z.string().optional().describe('Administrative description of the definition'),
      displayNameKey: z
        .string()
        .optional()
        .describe('Key of the field to use as the display name for instances'),
      fieldDefinitions: z
        .array(
          z.object({
            key: z.string().describe('Unique field key (e.g. "hex")'),
            name: z.string().describe('Field display name (e.g. "Hex")'),
            type: z
              .string()
              .describe(
                'Shopify field type, e.g. "single_line_text_field", "color", "number_integer", "file_reference"'
              ),
            description: z.string().optional(),
            required: z.boolean().optional().default(false),
            validations: z
              .array(z.object({ name: z.string(), value: z.string() }))
              .optional()
              .describe(
                'Field validations, e.g. [{ name: "regex", value: "^#([A-Fa-f0-9]{6})$" }]'
              ),
          })
        )
        .min(1)
        .describe('Field definitions — the "columns" of the model'),
      storefrontAccess: z
        .enum(['NONE', 'PUBLIC_READ'])
        .optional()
        .describe('Storefront read access for instances (PUBLIC_READ to render them in the theme)'),
      translatable: z
        .boolean()
        .optional()
        .describe(
          'Enable the translatable capability so field values can be translated per locale'
        ),
      publishable: z
        .boolean()
        .optional()
        .describe('Enable the publishable capability (gives instances a draft/active status)'),
    },
    async (args) => {
      try {
        const { storefrontAccess, translatable, publishable, ...rest } = args
        const params = { ...rest }
        if (storefrontAccess !== undefined) {
          params.access = { storefront: storefrontAccess }
        }
        if (translatable !== undefined || publishable !== undefined) {
          params.capabilities = {}
          if (translatable !== undefined)
            params.capabilities.translatable = { enabled: translatable }
          if (publishable !== undefined) params.capabilities.publishable = { enabled: publishable }
        }
        const result = await shopifyClient.createMetaobjectDefinition(params)
        const payload = result.data.metaobjectDefinitionCreate
        if (payload.userErrors.length > 0) {
          return {
            content: [
              {
                type: 'text',
                text: `Error creating metaobject definition: ${JSON.stringify(payload.userErrors)}`,
              },
            ],
            isError: true,
          }
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(payload.metaobjectDefinition, null, 2),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error creating metaobject definition: ${error.message}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
  server.tool(
    'updateMetaobjectDefinition',
    'Update an existing metaobject DEFINITION (metaobjectDefinitionUpdate): rename it, change displayNameKey, or add/update/delete fields. Field changes are operations: `addFields` creates new fields, `updateFields` renames/modifies existing ones (matched by key), `deleteFieldKeys` removes them. Get the id from listMetaobjectDefinitions / getMetaobjectDefinition.',
    {
      id: z
        .string()
        .describe('The metaobject definition GID (gid://shopify/MetaobjectDefinition/...)'),
      name: z.string().optional().describe('New display name'),
      description: z.string().optional(),
      displayNameKey: z.string().optional(),
      addFields: z
        .array(
          z.object({
            key: z.string(),
            name: z.string(),
            type: z.string().describe('Shopify field type, e.g. "single_line_text_field"'),
            description: z.string().optional(),
            required: z.boolean().optional().default(false),
            validations: z.array(z.object({ name: z.string(), value: z.string() })).optional(),
          })
        )
        .optional()
        .describe('New field definitions to create'),
      updateFields: z
        .array(
          z.object({
            key: z.string().describe('Key of the existing field to update'),
            name: z.string().optional(),
            description: z.string().optional(),
            required: z.boolean().optional(),
            validations: z.array(z.object({ name: z.string(), value: z.string() })).optional(),
          })
        )
        .optional()
        .describe('Existing fields to modify (matched by key)'),
      deleteFieldKeys: z
        .array(z.string())
        .optional()
        .describe('Keys of fields to remove from the definition'),
    },
    async (args) => {
      try {
        const { id, addFields, updateFields, deleteFieldKeys, ...rest } = args
        const params = { ...rest }
        const fieldDefinitions = [
          ...(addFields || []).map((field) => ({ create: field })),
          ...(updateFields || []).map((field) => ({ update: field })),
          ...(deleteFieldKeys || []).map((key) => ({ delete: { key } })),
        ]
        if (fieldDefinitions.length > 0) {
          params.fieldDefinitions = fieldDefinitions
        }
        const result = await shopifyClient.updateMetaobjectDefinition(id, params)
        const payload = result.data.metaobjectDefinitionUpdate
        if (payload.userErrors.length > 0) {
          return {
            content: [
              {
                type: 'text',
                text: `Error updating metaobject definition: ${JSON.stringify(payload.userErrors)}`,
              },
            ],
            isError: true,
          }
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(payload.metaobjectDefinition, null, 2),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error updating metaobject definition: ${error.message}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
  // Markets & Internationalization Tools
  server.tool(
    'listMarkets',
    'List configured markets',
    {
      limit: z.number().optional().default(10),
    },
    async (args) => {
      try {
        const result = await shopifyClient.getMarkets(args)
        const markets = result.data.markets.edges.map((edge) => edge.node)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(markets, null, 2),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error fetching markets: ${error.message}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
  // Price Rules Tools (migrated to discountNodes API)
  server.tool(
    'listPriceRules',
    'List discount rules (price rules migrated to new Discounts API)',
    {
      limit: z.number().optional().default(10),
      cursor: z.string().optional(),
    },
    async (args) => {
      try {
        const result = await shopifyClient.getPriceRules(args)
        // Transform discountNodes response to a price-rules-like format for compatibility
        const discounts = result.data.discountNodes.edges.map((edge) => {
          const discount = edge.node.discount
          return {
            id: edge.node.id,
            title: discount.title,
            status: discount.status,
            startsAt: discount.startsAt,
            endsAt: discount.endsAt,
            usageLimit: discount.usageLimit || null,
            usageCount: discount.asyncUsageCount || 0,
            type: discount.__typename,
            value: discount.customerGets?.value || null,
            combinesWith: discount.combinesWith || null,
          }
        })
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  discounts,
                  pageInfo: result.data.discountNodes.pageInfo,
                },
                null,
                2
              ),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error fetching discounts: ${error.message}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
  // Abandoned Checkout Tools
  server.tool(
    'listAbandonedCheckouts',
    'List abandoned checkouts',
    {
      limit: z.number().optional().default(10),
      cursor: z.string().optional(),
      query: z.string().optional(),
    },
    async (args) => {
      try {
        const result = await shopifyClient.getAbandonedCheckouts(args)
        const checkouts = result.data.abandonedCheckouts.edges.map((edge) => edge.node)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  checkouts,
                  pageInfo: result.data.abandonedCheckouts.pageInfo,
                },
                null,
                2
              ),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error fetching abandoned checkouts: ${error.message}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
  // Reports & Analytics Tools
  server.tool(
    'getSalesReport',
    'Get comprehensive sales analytics report',
    {
      startDate: z.string().describe('Start date (YYYY-MM-DD)'),
      endDate: z.string().describe('End date (YYYY-MM-DD)'),
      granularity: z
        .enum(['HOUR', 'DAY', 'WEEK', 'MONTH', 'QUARTER', 'YEAR'])
        .optional()
        .default('DAY'),
    },
    async (args) => {
      try {
        const result = await shopifyClient.getSalesReport(args)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.data, null, 2),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error fetching sales report: ${error.message}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
  server.tool(
    'getProductAnalytics',
    'Get product performance analytics',
    {
      startDate: z.string().describe('Start date (YYYY-MM-DD)'),
      endDate: z.string().describe('End date (YYYY-MM-DD)'),
      productIds: z.array(z.string()).optional(),
      limit: z.number().optional().default(50),
      sortBy: z
        .enum(['TOTAL_SALES', 'UNITS_SOLD', 'CONVERSION_RATE', 'PAGE_VIEWS'])
        .optional()
        .default('TOTAL_SALES'),
    },
    async (args) => {
      try {
        const result = await shopifyClient.getProductAnalytics(args)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.data, null, 2),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error fetching product analytics: ${error.message}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
  server.tool(
    'getCustomerAnalytics',
    'Get customer behavior analytics',
    {
      startDate: z.string().describe('Start date (YYYY-MM-DD)'),
      endDate: z.string().describe('End date (YYYY-MM-DD)'),
      metrics: z
        .array(
          z.enum([
            'NEW_CUSTOMERS',
            'RETURNING_CUSTOMERS',
            'AVERAGE_ORDER_VALUE',
            'LIFETIME_VALUE',
            'CHURN_RATE',
            'RETENTION_RATE',
          ])
        )
        .optional(),
    },
    async (args) => {
      try {
        const result = await shopifyClient.getCustomerAnalytics(args)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.data, null, 2),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error fetching customer analytics: ${error.message}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
  server.tool(
    'getInventoryReport',
    'Get inventory analytics and forecasting',
    {
      locationIds: z.array(z.string()).optional(),
      productIds: z.array(z.string()).optional(),
      includeForecasting: z.boolean().optional().default(true),
      forecastDays: z.number().optional().default(30),
    },
    async (args) => {
      try {
        const result = await shopifyClient.getInventoryReport(args)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.data, null, 2),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error fetching inventory report: ${error.message}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
  server.tool(
    'getMarketingReport',
    'Get marketing campaign performance',
    {
      startDate: z.string().describe('Start date (YYYY-MM-DD)'),
      endDate: z.string().describe('End date (YYYY-MM-DD)'),
      channels: z.array(z.enum(['EMAIL', 'SOCIAL', 'SEARCH', 'DIRECT', 'REFERRAL'])).optional(),
      campaignIds: z.array(z.string()).optional(),
    },
    async (args) => {
      try {
        const result = await shopifyClient.getMarketingReport(args)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.data, null, 2),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error fetching marketing report: ${error.message}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
  server.tool(
    'getFinancialSummary',
    'Get financial summary including revenue, expenses, and profit',
    {
      startDate: z.string().describe('Start date (YYYY-MM-DD)'),
      endDate: z.string().describe('End date (YYYY-MM-DD)'),
      includeRefunds: z.boolean().optional().default(true),
      includeTaxes: z.boolean().optional().default(true),
      includeShipping: z.boolean().optional().default(true),
      groupBy: z.enum(['DAY', 'WEEK', 'MONTH', 'QUARTER', 'YEAR']).optional().default('MONTH'),
    },
    async (args) => {
      try {
        const result = await shopifyClient.getFinancialSummary(args)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.data, null, 2),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error fetching financial summary: ${error.message}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
  server.tool(
    'getConversionReport',
    'Get conversion funnel analytics',
    {
      startDate: z.string().describe('Start date (YYYY-MM-DD)'),
      endDate: z.string().describe('End date (YYYY-MM-DD)'),
      funnelSteps: z
        .array(
          z.enum([
            'SITE_VISITS',
            'PRODUCT_VIEWS',
            'ADD_TO_CART',
            'REACHED_CHECKOUT',
            'COMPLETED_PURCHASE',
          ])
        )
        .optional(),
    },
    async (args) => {
      try {
        const result = await shopifyClient.getConversionReport(args)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.data, null, 2),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error fetching conversion report: ${error.message}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
  server.tool(
    'getAbandonmentReport',
    'Get cart and checkout abandonment analytics',
    {
      startDate: z.string().describe('Start date (YYYY-MM-DD)'),
      endDate: z.string().describe('End date (YYYY-MM-DD)'),
      groupBy: z.enum(['HOUR_OF_DAY', 'DAY_OF_WEEK', 'DEVICE_TYPE', 'TRAFFIC_SOURCE']).optional(),
    },
    async (args) => {
      try {
        const result = await shopifyClient.getAbandonmentReport(args)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.data, null, 2),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error fetching abandonment report: ${error.message}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
  server.tool(
    'getTrafficReport',
    'Get website traffic and visitor analytics',
    {
      startDate: z.string().describe('Start date (YYYY-MM-DD)'),
      endDate: z.string().describe('End date (YYYY-MM-DD)'),
      metrics: z
        .array(
          z.enum([
            'SESSIONS',
            'UNIQUE_VISITORS',
            'PAGE_VIEWS',
            'BOUNCE_RATE',
            'AVG_SESSION_DURATION',
            'PAGES_PER_SESSION',
          ])
        )
        .optional(),
      dimensions: z
        .array(z.enum(['SOURCE', 'MEDIUM', 'DEVICE', 'COUNTRY', 'LANDING_PAGE']))
        .optional(),
    },
    async (args) => {
      try {
        const result = await shopifyClient.getTrafficReport(args)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.data, null, 2),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error fetching traffic report: ${error.message}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
  server.tool(
    'getCustomReport',
    'Create a custom analytics report with specific metrics',
    {
      reportType: z.string().describe('Custom report type identifier'),
      startDate: z.string().describe('Start date (YYYY-MM-DD)'),
      endDate: z.string().describe('End date (YYYY-MM-DD)'),
      metrics: z.array(z.string()).describe('Array of metric names to include'),
      dimensions: z.array(z.string()).optional().describe('Array of dimension names to group by'),
      filters: z.record(z.string()).optional().describe('Key-value pairs for filtering data'),
      sortBy: z.string().optional(),
      limit: z.number().optional().default(100),
    },
    async (args) => {
      try {
        const result = await shopifyClient.getCustomReport(args)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.data, null, 2),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error fetching custom report: ${error.message}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
  // B2B Tools
  server.tool(
    'listCompanies',
    'List B2B companies',
    {
      limit: z.number().optional().default(10),
      cursor: z.string().optional(),
    },
    async (args) => {
      try {
        const result = await shopifyClient.getCompanies(args)
        const companies = result.data.companies.edges.map((edge) => edge.node)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  companies,
                  pageInfo: result.data.companies.pageInfo,
                },
                null,
                2
              ),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error fetching companies: ${error.message}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
  server.tool(
    'createCompany',
    'Create a B2B company',
    {
      name: z.string(),
      externalId: z.string().optional(),
      note: z.string().optional(),
      contactEmail: z.string().optional(),
      contactPhone: z.string().optional(),
    },
    async (args) => {
      try {
        const result = await shopifyClient.createCompany(args)
        if (result.data.companyCreate.userErrors.length > 0) {
          return {
            content: [
              {
                type: 'text',
                text: `Error creating company: ${JSON.stringify(result.data.companyCreate.userErrors)}`,
              },
            ],
            isError: true,
          }
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.data.companyCreate.company, null, 2),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error creating company: ${error.message}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
  // File / Media Tools
  server.tool(
    'createStagedUpload',
    'Create one or more staged upload targets (low-level). Returns the URL, resourceUrl and form parameters required to POST the file to Shopify storage. Most callers should use `uploadFile` instead.',
    {
      uploads: z
        .array(
          z.object({
            filename: z.string(),
            mimeType: z.string().describe('e.g., "image/jpeg", "image/png", "application/pdf"'),
            resource: z
              .enum([
                'FILE',
                'IMAGE',
                'VIDEO',
                'MODEL_3D',
                'PRODUCT_IMAGE',
                'COLLECTION_IMAGE',
                'SHOP_IMAGE',
                'URL_REDIRECT_IMPORT',
              ])
              .default('FILE'),
            httpMethod: z.enum(['POST', 'PUT']).optional().default('POST'),
            fileSize: z
              .string()
              .optional()
              .describe('Required for VIDEO and MODEL_3D resources. Size in bytes as a string.'),
          })
        )
        .describe('One or more staged upload definitions'),
    },
    async (args) => {
      try {
        const result = await shopifyClient.stagedUploadsCreate(args.uploads)
        const payload = result.data.stagedUploadsCreate
        if (payload.userErrors.length > 0) {
          return {
            content: [
              {
                type: 'text',
                text: `Error creating staged upload: ${JSON.stringify(payload.userErrors)}`,
              },
            ],
            isError: true,
          }
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(payload.stagedTargets, null, 2),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error creating staged upload: ${error.message}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
  server.tool(
    'createFile',
    'Register one or more files in Shopify (low-level fileCreate). `originalSource` may be a publicly accessible URL OR a `resourceUrl` returned by `createStagedUpload`. Most callers should use `uploadFile` to upload from base64 data.',
    {
      files: z
        .array(
          z.object({
            originalSource: z
              .string()
              .describe('Public URL or resourceUrl from a previous createStagedUpload call'),
            contentType: z
              .enum(['FILE', 'IMAGE', 'VIDEO', 'EXTERNAL_VIDEO', 'MODEL_3D'])
              .default('FILE'),
            alt: z.string().max(512).optional().describe('Accessibility text (max 512 chars)'),
            filename: z.string().optional(),
            duplicateResolutionMode: z.enum(['APPEND_UUID', 'RAISE_ERROR', 'REPLACE']).optional(),
          })
        )
        .describe('One or more files to create'),
    },
    async (args) => {
      try {
        const result = await shopifyClient.fileCreate(args.files)
        const payload = result.data.fileCreate
        if (payload.userErrors.length > 0) {
          return {
            content: [
              {
                type: 'text',
                text: `Error creating file: ${JSON.stringify(payload.userErrors)}`,
              },
            ],
            isError: true,
          }
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(payload.files, null, 2),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error creating file: ${error.message}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
  server.tool(
    'uploadFile',
    'Upload a file from base64 data to the Shopify Files library. Runs the full flow: stagedUploadsCreate -> multipart POST to Shopify storage -> fileCreate. Returns the created file with its CDN URL.',
    {
      filename: z.string().describe('Filename including extension, e.g., "photo.jpg"'),
      mimeType: z
        .string()
        .describe('e.g., "image/jpeg", "image/png", "application/pdf", "video/mp4"'),
      data: z.string().describe('File content encoded as a base64 string (no data: URI prefix)'),
      resource: z
        .enum([
          'FILE',
          'IMAGE',
          'VIDEO',
          'MODEL_3D',
          'PRODUCT_IMAGE',
          'COLLECTION_IMAGE',
          'SHOP_IMAGE',
        ])
        .optional()
        .default('FILE')
        .describe('Staged upload resource type. Defaults to FILE; use IMAGE for general images.'),
      alt: z.string().max(512).optional().describe('Accessibility text (max 512 chars)'),
      duplicateResolutionMode: z
        .enum(['APPEND_UUID', 'RAISE_ERROR', 'REPLACE'])
        .optional()
        .describe('How Shopify should resolve filename conflicts'),
    },
    async (args) => {
      try {
        const result = await shopifyClient.uploadFile(args)
        const payload = result.data.fileCreate
        if (payload.userErrors.length > 0) {
          return {
            content: [
              {
                type: 'text',
                text: `Error uploading file: ${JSON.stringify(payload.userErrors)}`,
              },
            ],
            isError: true,
          }
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  files: payload.files,
                  stagedTarget: result.stagedTarget,
                },
                null,
                2
              ),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error uploading file: ${error.message}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
  server.tool(
    'updateImageAlt',
    'Update the ALT (accessibility) text of one or more existing images via the fileUpdate mutation (batchable). ' +
      'Use the MediaImage GID (gid://shopify/MediaImage/...) obtained from getProduct -> media nodes — NOT the product id or the legacy Image id. ' +
      'LIMITATIONS: (1) This only WRITES alt text — Shopify silently ignores an empty string ("") so it cannot CLEAR an alt. ' +
      '(2) Only update media whose status is READY (visible via getProduct). ' +
      '(3) Requires the write_files (or write_themes) access scope — write_products alone is NOT sufficient.',
    {
      files: z
        .array(
          z.object({
            id: z
              .string()
              .describe(
                'MediaImage GID, e.g. gid://shopify/MediaImage/123 (from getProduct -> media nodes)'
              ),
            alt: z.string().max(512).describe('New accessibility text (max 512 characters)'),
          })
        )
        .min(1)
        .max(25)
        .describe(
          '1–25 images per call (stays within the Shopify GraphQL cost budget; no Bulk API needed).'
        ),
    },
    async (args) => {
      try {
        const result = await shopifyClient.fileUpdate(args.files)
        const payload = result.data.fileUpdate
        if (payload.userErrors.length > 0) {
          return {
            content: [
              {
                type: 'text',
                text: `Error updating image alt: ${JSON.stringify(payload.userErrors)}`,
              },
            ],
            isError: true,
          }
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(payload.files, null, 2),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error updating image alt: ${error.message}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
}
// Register resources
function registerResources(server, shopifyClient) {
  // Resources
  server.resource('products', 'Browse product catalog', async () => {
    try {
      const result = await shopifyClient.getProducts({ limit: 50 })
      const products = result.data.products.edges.map((edge) => edge.node)
      return {
        contents: [
          {
            uri: 'shopify://products',
            mimeType: 'application/json',
            text: JSON.stringify(products, null, 2),
          },
        ],
      }
    } catch (error) {
      return {
        contents: [
          {
            uri: 'shopify://products',
            mimeType: 'text/plain',
            text: `Error loading products: ${error.message}`,
          },
        ],
      }
    }
  })
  server.resource('orders', 'Browse recent orders', async () => {
    try {
      const result = await shopifyClient.getOrders({ limit: 50 })
      const orders = result.data.orders.edges.map((edge) => edge.node)
      return {
        contents: [
          {
            uri: 'shopify://orders',
            mimeType: 'application/json',
            text: JSON.stringify(orders, null, 2),
          },
        ],
      }
    } catch (error) {
      return {
        contents: [
          {
            uri: 'shopify://orders',
            mimeType: 'text/plain',
            text: `Error loading orders: ${error.message}`,
          },
        ],
      }
    }
  })
}
// Register prompts
function registerPrompts(server) {
  // Prompts
  server.prompt('analyze-sales', 'Analyze sales trends and patterns', async () => {
    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: 'Please analyze the sales trends for the last 30 days. Look at order volumes, revenue trends, popular products, and customer patterns. Use the listOrders tool with appropriate date filters and the listProducts tool to gather data.',
          },
        },
      ],
    }
  })
  server.prompt('inventory-check', 'Check for low inventory items', async () => {
    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: 'Please check for products with low inventory levels. Use the listProducts tool to get all products and identify items with inventory below 10 units. Provide a summary of products that need restocking.',
          },
        },
      ],
    }
  })
  server.prompt('customer-insights', 'Generate customer insights', async () => {
    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: 'Please analyze customer data to provide insights. Use the listCustomers tool to identify top customers by order count and spending. Look for patterns in customer locations and order frequency.',
          },
        },
      ],
    }
  })
}
// Start the server
async function main() {
  const transportMode = process.env.TRANSPORT_MODE || 'stdio'
  if (transportMode === 'sse') {
    // SSE mode - run as HTTP server
    const port = parseInt(process.env.PORT || '3000', 10)
    const app = express()

    // Store active transports by session ID (for legacy SSE endpoint)
    const transports = new Map()

    // Health check endpoint
    app.get('/health', (_req, res) => {
      res.json({ status: 'ok', mode: 'sse' })
    })

    // ==========================================================================
    // CUSTOM MCP HTTP ENDPOINT - NO SDK TRANSPORT (NO ACCEPT HEADER VALIDATION)
    // ==========================================================================
    //
    // This endpoint handles MCP protocol directly without using the SDK's
    // StreamableHTTPServerTransport, which has strict Accept header validation
    // that causes 406 errors with Claude.ai web.
    //
    // The MCP protocol is just JSON-RPC over HTTP - we handle it ourselves.
    // ==========================================================================

    // Store for custom transport sessions
    const mcpSessions = new Map()

    // Session TTL: 1 hour (sessions without activity will be cleaned up)
    const SESSION_TTL_MS = 3600000

    // Cleanup expired sessions every minute
    setInterval(() => {
      const now = Date.now()
      for (const [id, session] of mcpSessions) {
        if (now - session.lastActivity > SESSION_TTL_MS) {
          console.log(`MCP session expired: ${id}`)
          session.transport.close()
          mcpSessions.delete(id)
        }
      }
    }, 60000)

    /**
     * Custom MCP Transport class that works with McpServer.connect()
     * No Accept header validation!
     */
    class CustomMcpTransport {
      constructor(sessionId) {
        this.sessionId = sessionId
        this._messageHandler = null
        this._closeHandler = null
        this._errorHandler = null
        this._pendingResponses = new Map()
        this._sseRes = null
      }

      set onmessage(handler) {
        this._messageHandler = handler
      }
      get onmessage() {
        return this._messageHandler
      }

      set onclose(handler) {
        this._closeHandler = handler
      }
      get onclose() {
        return this._closeHandler
      }

      set onerror(handler) {
        this._errorHandler = handler
      }
      get onerror() {
        return this._errorHandler
      }

      async start() {
        // No-op for HTTP transport
      }

      async close() {
        if (this._closeHandler) this._closeHandler()
        if (this._sseRes) {
          try {
            this._sseRes.end()
          } catch (e) {
            // Connection already closed
          }
          this._sseRes = null
        }
      }

      // Called by McpServer to send responses/notifications
      async send(message) {
        // If this is a response (has id) and we have a pending callback, use it
        if (message.id !== undefined && this._pendingResponses.has(message.id)) {
          const callback = this._pendingResponses.get(message.id)
          this._pendingResponses.delete(message.id)
          callback(message)
        }
        // Also send to SSE if connected (for server-initiated notifications)
        if (this._sseRes && !this._sseRes.writableEnded) {
          try {
            this._sseRes.write(`event: message\ndata: ${JSON.stringify(message)}\n\n`)
          } catch (e) {
            // SSE connection closed
            this._sseRes = null
          }
        }
      }

      /**
       * Handle incoming JSON-RPC message
       * - Requests (with id): returns a Promise that resolves to the response
       * - Notifications (without id): returns null immediately (no response expected)
       */
      handleMessage(jsonRpcMessage) {
        // JSON-RPC Notification: no id field = no response expected
        // Per spec: "The Server MUST NOT reply to a Notification"
        if (jsonRpcMessage.id === undefined) {
          // Just pass to handler, don't wait for response
          if (this._messageHandler) {
            this._messageHandler(jsonRpcMessage)
          }
          return null
        }

        // JSON-RPC Request: has id = response expected
        return new Promise((resolve, reject) => {
          // Timeout after 30 seconds
          const timeout = setTimeout(() => {
            this._pendingResponses.delete(jsonRpcMessage.id)
            reject(new Error(`Request timeout for method: ${jsonRpcMessage.method}`))
          }, 30000)

          this._pendingResponses.set(jsonRpcMessage.id, (response) => {
            clearTimeout(timeout)
            resolve(response)
          })

          // Pass to McpServer
          if (this._messageHandler) {
            this._messageHandler(jsonRpcMessage)
          } else {
            // No handler connected - this shouldn't happen
            clearTimeout(timeout)
            this._pendingResponses.delete(jsonRpcMessage.id)
            reject(new Error('Transport not connected to server'))
          }
        })
      }

      // Set SSE response for server-initiated messages
      setSseResponse(res) {
        this._sseRes = res
      }
    }

    // Main /mcp endpoint handler
    app.all('/mcp', async (req, res) => {
      console.log(`MCP ${req.method} request, Accept: ${req.headers['accept'] || 'none'}`)

      try {
        // CORS preflight
        if (req.method === 'OPTIONS') {
          res.status(204).end()
          return
        }

        const sessionId = req.headers['mcp-session-id']

        // DELETE - terminate session
        if (req.method === 'DELETE') {
          if (sessionId && mcpSessions.has(sessionId)) {
            const session = mcpSessions.get(sessionId)
            await session.transport.close()
            mcpSessions.delete(sessionId)
            console.log(`MCP session terminated: ${sessionId}`)
          }
          res.status(204).end()
          return
        }

        // GET - SSE stream for server notifications
        if (req.method === 'GET') {
          if (!sessionId || !mcpSessions.has(sessionId)) {
            res.status(400).json({
              jsonrpc: '2.0',
              error: { code: -32600, message: 'Invalid or missing session ID' },
              id: null,
            })
            return
          }

          const session = mcpSessions.get(sessionId)
          session.lastActivity = Date.now()

          res.setHeader('Content-Type', 'text/event-stream')
          res.setHeader('Cache-Control', 'no-cache')
          res.setHeader('Connection', 'keep-alive')
          res.flushHeaders()

          session.transport.setSseResponse(res)

          const keepAlive = setInterval(() => {
            if (!res.writableEnded) {
              try {
                res.write(':keepalive\n\n')
              } catch (e) {
                clearInterval(keepAlive)
              }
            }
          }, 30000)

          req.on('close', () => {
            clearInterval(keepAlive)
            if (mcpSessions.has(sessionId)) {
              mcpSessions.get(sessionId).transport.setSseResponse(null)
            }
          })
          return
        }

        // POST - JSON-RPC messages
        if (req.method === 'POST') {
          // Read body
          let body = req.body
          if (!body || Object.keys(body).length === 0) {
            const chunks = []
            for await (const chunk of req) {
              chunks.push(chunk)
            }
            const rawBody = Buffer.concat(chunks).toString()

            // Parse JSON with error handling
            try {
              body = JSON.parse(rawBody)
            } catch (parseError) {
              res.status(400).json({
                jsonrpc: '2.0',
                error: { code: -32700, message: 'Parse error: Invalid JSON' },
                id: null,
              })
              return
            }
          }

          let session

          // Existing session?
          if (sessionId && mcpSessions.has(sessionId)) {
            session = mcpSessions.get(sessionId)
            session.lastActivity = Date.now()
          } else if (body.method === 'initialize') {
            // New session
            const newSessionId = randomUUID()
            const transport = new CustomMcpTransport(newSessionId)
            const mcpServer = createMcpServer(globalShopifyClient)

            await mcpServer.connect(transport)

            session = {
              id: newSessionId,
              transport,
              server: mcpServer,
              createdAt: Date.now(),
              lastActivity: Date.now(),
            }
            mcpSessions.set(newSessionId, session)
            console.log(`MCP new session: ${newSessionId}`)
          } else {
            res.status(400).json({
              jsonrpc: '2.0',
              error: { code: -32600, message: 'Bad Request: Server not initialized' },
              id: body.id || null,
            })
            return
          }

          // Process message (request or notification)
          const response = await session.transport.handleMessage(body)

          // If it was a notification (no id), response is null - just acknowledge
          if (response === null) {
            res.status(202).end() // 202 Accepted for notifications
            return
          }

          // Set session ID header for initialize
          if (body.method === 'initialize') {
            res.setHeader('Mcp-Session-Id', session.id)
          }

          // Send response as SSE event (MCP protocol format)
          res.setHeader('Content-Type', 'text/event-stream')
          res.setHeader('Cache-Control', 'no-cache')
          res.write(`event: message\ndata: ${JSON.stringify(response)}\n\n`)
          res.end()
          return
        }

        res.status(405).json({ error: 'Method not allowed' })
      } catch (error) {
        console.error('MCP error:', error)
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: '2.0',
            error: { code: -32603, message: error.message },
            id: null,
          })
        }
      }
    })

    // SSE endpoint for establishing the stream (legacy transport) - AUTHLESS
    app.get('/sse', async (req, res) => {
      console.log('New SSE connection established')

      try {
        // Create a new SSE transport (using global Shopify client)
        const transport = new SSEServerTransport('/messages', res)
        const sessionId = transport.sessionId
        // Store the transport
        transports.set(sessionId, transport)
        // Set up cleanup on close
        transport.onclose = () => {
          console.log(`SSE connection closed: ${sessionId}`)
          transports.delete(sessionId)
        }
        // Create a new server instance for this connection with the global client
        const mcpServer = createMcpServer(globalShopifyClient)
        // Connect the transport to the server
        await mcpServer.connect(transport)
        // Start the SSE stream
        await transport.start()
      } catch (error) {
        console.error('Error establishing SSE connection:', error)
        if (!res.headersSent) {
          res.writeHead(500)
          res.end('Error establishing SSE connection')
        }
      }
    })
    // Messages endpoint for receiving client messages (needs JSON parsing)
    app.post('/messages', express.json(), async (req, res) => {
      const sessionId = req.query.sessionId
      if (!sessionId) {
        res.status(400).send('Missing sessionId parameter')
        return
      }
      const transport = transports.get(sessionId)
      if (!transport) {
        res.status(404).send('Session not found')
        return
      }
      try {
        await transport.handlePostMessage(req, res, req.body)
      } catch (error) {
        console.error('Error handling message:', error)
        if (!res.headersSent) {
          res.status(500).send('Error handling message')
        }
      }
    })
    // Start the HTTP server
    app.listen(port, () => {
      console.log(`Shopify MCP Server (SSE mode) listening on port ${port}`)
      console.log(`SSE endpoint: http://localhost:${port}/sse`)
    })
    // Graceful shutdown
    process.on('SIGINT', () => {
      console.log('Shutting down SSE server...')
      transports.forEach((transport) => transport.close())
      process.exit(0)
    })
  } else {
    // Stdio mode - original implementation
    process.stdout.on('error', () => {})
    process.stderr.on('error', () => {})
    process.on('uncaughtException', (error) => {
      if (error.message && error.message.includes('JSON')) {
        return
      }
      process.stderr.write(`[Uncaught Exception]: ${error.message}\n`)
      process.exit(1)
    })
    process.on('unhandledRejection', (reason) => {
      process.stderr.write(`[Unhandled Rejection]: ${reason}\n`)
    })
    const transport = new StdioServerTransport()
    transport.onerror = () => {}
    const shutdown = async () => {
      try {
        await server.close()
      } catch (error) {
        // Silent shutdown
      }
      process.exit(0)
    }
    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)
    try {
      await server.connect(transport)
      setTimeout(() => {
        process.stderr.write('Shopify MCP Server started successfully\n')
      }, 100)
    } catch (error) {
      process.stderr.write(`Failed to start server: ${error.message}\n`)
      process.exit(1)
    }
  }
}
// Create MCP server instance - moved to separate function for SSE mode
function createMcpServer(shopifyClient) {
  const mcpServer = new McpServer({
    name: 'shopify-mcp-server',
    version: '1.0.0',
  })
  // Register all tools and resources on the new instance
  registerTools(mcpServer, shopifyClient)
  registerResources(mcpServer, shopifyClient)
  registerPrompts(mcpServer)
  return mcpServer
}
// For stdio mode, create server with global client (already validated at startup)
let server
const transportMode = process.env.TRANSPORT_MODE || 'stdio'
if (transportMode === 'stdio') {
  server = createMcpServer(globalShopifyClient)
}
main()
//# sourceMappingURL=index.js.map
