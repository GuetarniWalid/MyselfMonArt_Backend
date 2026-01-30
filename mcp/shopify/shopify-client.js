import '@shopify/shopify-api/adapters/node'
import { shopifyApi, ApiVersion, Session, LogSeverity } from '@shopify/shopify-api'
export class ShopifyClient {
  client
  session
  getLogLevel(envLevel) {
    switch (envLevel?.toUpperCase()) {
      case 'ERROR':
        return LogSeverity.Error
      case 'WARNING':
      case 'WARN':
        return LogSeverity.Warning
      case 'INFO':
        return LogSeverity.Info
      case 'DEBUG':
        return LogSeverity.Debug
      default:
        // Default to Warning for production safety
        return LogSeverity.Warning
    }
  }
  constructor(config) {
    // Determine log level from environment or default to Warning for production
    const logLevel = this.getLogLevel(process.env.SHOPIFY_LOG_LEVEL)
    this.client = shopifyApi({
      apiKey: 'dummy-key', // Not needed for private apps
      apiSecretKey: 'dummy-secret', // Not needed for private apps
      scopes: [], // Not needed for private apps
      hostName: 'localhost', // Not needed for private apps
      isEmbeddedApp: false, // Required field
      // Hardcoded to October25 (2025-10) - latest version with ShopifyQL, inventoryAdjustQuantities, fulfillmentCreate
      apiVersion: ApiVersion.October25,
      logger: {
        level: logLevel,
        // Redirect all logs to stderr to avoid stdout pollution
        log: async (severity, message) => {
          // Only log if the message severity meets our configured level
          process.stderr.write(`[Shopify/${severity}] ${message}\n`)
        },
        // Enable HTTP request logging in development
        httpRequests: process.env.NODE_ENV === 'development',
      },
    })
    this.session = new Session({
      id: 'offline_' + config.storeDomain,
      shop: config.storeDomain,
      state: 'active',
      isOnline: false,
      accessToken: config.accessToken,
    })
  }
  async graphql(query, variables) {
    try {
      const client = new this.client.clients.Graphql({ session: this.session })
      const response = await client.request(query, { variables })
      return response
    } catch (error) {
      if (error.response?.errors) {
        throw new Error(`GraphQL Error: ${JSON.stringify(error.response.errors)}`)
      }
      throw error
    }
  }
  async rest(path, method = 'GET', data) {
    try {
      const restClient = new this.client.clients.Rest({ session: this.session })
      let response
      switch (method) {
        case 'GET':
          response = await restClient.client.get(path)
          break
        case 'POST':
          response = await restClient.client.post(path, { data })
          break
        case 'PUT':
          response = await restClient.client.put(path, { data })
          break
        case 'DELETE':
          response = await restClient.client.delete(path)
          break
        default:
          throw new Error(`Unsupported HTTP method: ${method}`)
      }
      return response.body
    } catch (error) {
      if (error.response?.body?.errors) {
        throw new Error(`REST API Error: ${JSON.stringify(error.response.body.errors)}`)
      }
      throw error
    }
  }
  // Input validation helpers for analytics
  // Shopify GraphQL API limits results to 250 items per request
  static SHOPIFY_MAX_LIMIT = 250
  validateShopifyDate(date) {
    if (!date) return null
    // Allow relative dates: negative (-30d) or positive (+7d) offsets, or special keywords
    // Supported units: d=days, w=weeks, m=months, y=years
    const relativePattern = /^([+-]?\d+[dwmy]|today|yesterday)$/
    // Allow ISO 8601 dates (YYYY-MM-DD) with basic validation for valid month/day ranges
    const isoPattern = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/
    if (relativePattern.test(date) || isoPattern.test(date)) {
      return date
    }
    throw new Error(
      `Invalid date format: ${date}. Use ISO 8601 (YYYY-MM-DD) or relative format (-30d, +7d, -1w, today, yesterday, etc.)`
    )
  }
  // Convert relative date strings to ISO 8601 format (YYYY-MM-DD)
  convertRelativeToISO(relativeDate) {
    if (!relativeDate) return null
    // Already ISO format
    if (/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(relativeDate)) {
      return relativeDate
    }
    const now = new Date()
    // Handle special keywords
    if (relativeDate === 'today') {
      return now.toISOString().split('T')[0]
    }
    if (relativeDate === 'yesterday') {
      now.setDate(now.getDate() - 1)
      return now.toISOString().split('T')[0]
    }
    // Handle relative offsets like -30d, +7d, -1w, -1m, -1y
    const match = relativeDate.match(/^([+-]?\d+)([dwmy])$/)
    if (match) {
      const value = parseInt(match[1], 10)
      const unit = match[2]
      switch (unit) {
        case 'd':
          now.setDate(now.getDate() + value)
          break
        case 'w':
          now.setDate(now.getDate() + value * 7)
          break
        case 'm':
          now.setMonth(now.getMonth() + value)
          break
        case 'y':
          now.setFullYear(now.getFullYear() + value)
          break
      }
      return now.toISOString().split('T')[0]
    }
    // Return as-is if not recognized (validation should catch invalid formats)
    return relativeDate
  }
  // Get validated ISO date range with defaults (for GraphQL search queries that require ISO dates)
  getISODateRange(params, defaultDays = 30) {
    const now = new Date()
    const defaultStart = new Date(now.getTime() - defaultDays * 24 * 60 * 60 * 1000)
    let startDate = params?.startDate
    let endDate = params?.endDate
    // Validate and convert startDate
    if (startDate) {
      this.validateShopifyDate(startDate)
      startDate = this.convertRelativeToISO(startDate)
    } else {
      startDate = defaultStart.toISOString().split('T')[0]
    }
    // Validate and convert endDate
    if (endDate) {
      this.validateShopifyDate(endDate)
      endDate = this.convertRelativeToISO(endDate)
    } else {
      endDate = now.toISOString().split('T')[0]
    }
    return { startDate, endDate }
  }
  validateGranularity(granularity) {
    const validGranularities = ['day', 'week', 'month', 'quarter', 'year', 'hour']
    if (!granularity) return 'day'
    // ShopifyQL expects lowercase granularity values
    const normalizedGranularity = granularity.toLowerCase()
    if (validGranularities.includes(normalizedGranularity)) {
      return normalizedGranularity
    }
    throw new Error(
      `Invalid granularity: ${granularity}. Valid values: ${validGranularities.join(', ')}`
    )
  }
  validatePositiveInt(value, fieldName, defaultValue) {
    if (value === undefined || value === null) return defaultValue
    const num = parseInt(value, 10)
    // Shopify GraphQL API limits to 250 items per request
    if (isNaN(num) || num < 1 || num > ShopifyClient.SHOPIFY_MAX_LIMIT) {
      throw new Error(
        `Invalid ${fieldName}: must be a positive integer between 1 and ${ShopifyClient.SHOPIFY_MAX_LIMIT}`
      )
    }
    return num
  }
  // ShopifyQL helper with error handling
  // Note: shopifyqlQuery returns tableData directly (no union types or fragments)
  async executeShopifyQL(shopifyqlQuery) {
    const query = `
      query executeShopifyQL($query: String!) {
        shopifyqlQuery(query: $query) {
          tableData {
            columns {
              name
              dataType
              displayName
            }
            rows
          }
          parseErrors
        }
      }
    `
    const result = await this.graphql(query, { query: shopifyqlQuery })
    const shopifyqlResult = result.data?.shopifyqlQuery
    // Check for parse errors
    if (shopifyqlResult?.parseErrors?.length > 0) {
      const parseErrors = shopifyqlResult.parseErrors
      // parseErrors is an array of error strings
      const errorMessages = parseErrors.map((e) => (typeof e === 'string' ? e : JSON.stringify(e)))
      throw new Error(`ShopifyQL Parse Error: ${errorMessages.join('; ')}`)
    }
    // Check if we got table data
    if (!shopifyqlResult?.tableData) {
      throw new Error('ShopifyQL Error: No data returned from query')
    }
    return result
  }
  // Product operations
  async getProducts(params) {
    const query = `
      query getProducts($first: Int!, $after: String, $query: String, $sortKey: ProductSortKeys, $reverse: Boolean) {
        products(first: $first, after: $after, query: $query, sortKey: $sortKey, reverse: $reverse) {
          edges {
            cursor
            node {
              id
              title
              handle
              descriptionHtml
              vendor
              productType
              tags
              status
              totalInventory
              priceRangeV2 {
                minVariantPrice {
                  amount
                  currencyCode
                }
                maxVariantPrice {
                  amount
                  currencyCode
                }
              }
              images(first: 5) {
                edges {
                  node {
                    url
                    altText
                  }
                }
              }
              variants(first: 10) {
                edges {
                  node {
                    id
                    title
                    price
                    sku
                    inventoryQuantity
                  }
                }
              }
            }
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
          }
        }
      }
    `
    const variables = {
      first: params.limit || 10,
      after: params.cursor,
      query: params.query,
      sortKey: params.sortKey,
      reverse: params.reverse || false,
    }
    return this.graphql(query, variables)
  }
  async getProduct(id) {
    const query = `
      query getProduct($id: ID!) {
        product(id: $id) {
          id
          title
          handle
          descriptionHtml
          vendor
          productType
          tags
          status
          totalInventory
          seo {
            title
            description
          }
          priceRangeV2 {
            minVariantPrice {
              amount
              currencyCode
            }
            maxVariantPrice {
              amount
              currencyCode
            }
          }
          images(first: 20) {
            edges {
              node {
                url
                altText
              }
            }
          }
          variants(first: 100) {
            edges {
              node {
                id
                title
                price
                sku
                barcode
                inventoryQuantity
                weight
                weightUnit
              }
            }
          }
          metafields(first: 20) {
            edges {
              node {
                namespace
                key
                value
                type
              }
            }
          }
        }
      }
    `
    return this.graphql(query, { id })
  }
  async createProduct(input) {
    const mutation = `
      mutation createProduct($input: ProductInput!) {
        productCreate(input: $input) {
          product {
            id
            title
            handle
          }
          userErrors {
            field
            message
          }
        }
      }
    `
    return this.graphql(mutation, { input })
  }
  async updateProduct(id, input) {
    const mutation = `
      mutation updateProduct($input: ProductInput!) {
        productUpdate(input: $input) {
          product {
            id
            title
            handle
          }
          userErrors {
            field
            message
          }
        }
      }
    `
    return this.graphql(mutation, { input: { ...input, id } })
  }
  // Order operations
  async getOrders(params) {
    const query = `
      query getOrders($first: Int!, $after: String, $query: String, $sortKey: OrderSortKeys, $reverse: Boolean) {
        orders(first: $first, after: $after, query: $query, sortKey: $sortKey, reverse: $reverse) {
          edges {
            cursor
            node {
              id
              name
              createdAt
              updatedAt
              displayFinancialStatus
              displayFulfillmentStatus
              totalPriceSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
              customer {
                id
                email
                firstName
                lastName
              }
              lineItems(first: 10) {
                edges {
                  node {
                    title
                    quantity
                    originalUnitPriceSet {
                      shopMoney {
                        amount
                        currencyCode
                      }
                    }
                  }
                }
              }
              shippingAddress {
                address1
                address2
                city
                province
                country
                zip
              }
            }
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
          }
        }
      }
    `
    let queryString = ''
    if (params.status) queryString += `status:${params.status} `
    if (params.financialStatus) queryString += `financial_status:${params.financialStatus} `
    if (params.fulfillmentStatus) queryString += `fulfillment_status:${params.fulfillmentStatus} `
    if (params.query) queryString += params.query
    const variables = {
      first: params.limit || 10,
      after: params.cursor,
      query: queryString.trim() || null,
      sortKey: params.sortKey || 'CREATED_AT',
      reverse: params.reverse !== undefined ? params.reverse : true,
    }
    return this.graphql(query, variables)
  }
  async getOrder(id) {
    const query = `
      query getOrder($id: ID!) {
        order(id: $id) {
          id
          name
          createdAt
          updatedAt
          displayFinancialStatus
          displayFulfillmentStatus
          note
          tags
          totalPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          subtotalPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          totalTaxSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          customer {
            id
            email
            firstName
            lastName
            phone
          }
          lineItems(first: 250) {
            edges {
              node {
                id
                title
                quantity
                sku
                vendor
                originalUnitPriceSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                totalDiscountSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
              }
            }
          }
          shippingAddress {
            firstName
            lastName
            address1
            address2
            city
            province
            country
            zip
            phone
          }
          billingAddress {
            firstName
            lastName
            address1
            address2
            city
            province
            country
            zip
            phone
          }
          fulfillments {
            status
            createdAt
            trackingInfo {
              number
              url
            }
          }
          transactions {
            kind
            status
            amount
            gateway
          }
        }
      }
    `
    return this.graphql(query, { id })
  }
  // Customer operations
  async getCustomers(params) {
    const query = `
      query getCustomers($first: Int!, $after: String, $query: String, $sortKey: CustomerSortKeys, $reverse: Boolean) {
        customers(first: $first, after: $after, query: $query, sortKey: $sortKey, reverse: $reverse) {
          edges {
            cursor
            node {
              id
              email
              firstName
              lastName
              phone
              state
              numberOfOrders
              amountSpent {
                amount
                currencyCode
              }
              createdAt
              updatedAt
              defaultAddress {
                address1
                address2
                city
                province
                country
                zip
              }
              tags
            }
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
          }
        }
      }
    `
    const variables = {
      first: params.limit || 10,
      after: params.cursor,
      query: params.query,
      sortKey: params.sortKey,
      reverse: params.reverse || false,
    }
    return this.graphql(query, variables)
  }
  async getCustomer(id) {
    const query = `
      query getCustomer($id: ID!) {
        customer(id: $id) {
          id
          email
          firstName
          lastName
          phone
          state
          numberOfOrders
          amountSpent {
            amount
            currencyCode
          }
          createdAt
          updatedAt
          defaultAddress {
            address1
            address2
            city
            province
            country
            zip
          }
          addresses(first: 10) {
            address1
            address2
            city
            province
            country
            zip
            phone
          }
          orders(first: 10) {
            edges {
              node {
                id
                name
                createdAt
                totalPriceSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                displayFinancialStatus
                displayFulfillmentStatus
              }
            }
          }
          metafields(first: 20) {
            edges {
              node {
                namespace
                key
                value
                type
              }
            }
          }
          tags
        }
      }
    `
    return this.graphql(query, { id })
  }
  // Inventory operations
  async getInventoryLevels(inventoryItemId) {
    const query = `
      query getInventoryLevels($inventoryItemId: ID!) {
        inventoryItem(id: $inventoryItemId) {
          id
          sku
          tracked
          inventoryLevels(first: 10) {
            edges {
              node {
                id
                available
                location {
                  id
                  name
                }
              }
            }
          }
        }
      }
    `
    return this.graphql(query, { inventoryItemId })
  }
  async adjustInventory(inventoryItemId, locationId, quantity) {
    // Use the new inventoryAdjustQuantities mutation (API 2025-10+)
    // No longer need to fetch inventoryLevelId first
    const mutation = `
      mutation inventoryAdjustQuantities($input: InventoryAdjustQuantitiesInput!) {
        inventoryAdjustQuantities(input: $input) {
          inventoryAdjustmentGroup {
            id
            reason
            changes {
              name
              delta
              quantityAfterChange
            }
          }
          userErrors {
            field
            message
            code
          }
        }
      }
    `
    const input = {
      reason: 'correction',
      name: 'available',
      changes: [
        {
          inventoryItemId,
          locationId,
          delta: quantity,
        },
      ],
    }
    return this.graphql(mutation, { input })
  }
  // Metafield operations
  async setMetafield(ownerId, metafield) {
    const mutation = `
      mutation setMetafield($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields {
            id
            namespace
            key
            value
          }
          userErrors {
            field
            message
          }
        }
      }
    `
    const metafields = [
      {
        ownerId,
        namespace: metafield.namespace,
        key: metafield.key,
        value: metafield.value,
        type: metafield.type || 'single_line_text_field',
      },
    ]
    return this.graphql(mutation, { metafields })
  }
  // Collection operations
  async getCollections(params) {
    const query = `
      query getCollections($first: Int!, $after: String, $query: String) {
        collections(first: $first, after: $after, query: $query) {
          edges {
            cursor
            node {
              id
              title
              handle
              descriptionHtml
              image {
                url
                altText
              }
              productsCount
              updatedAt
            }
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
          }
        }
      }
    `
    const variables = {
      first: params.limit || 10,
      after: params.cursor,
      query: params.query,
    }
    return this.graphql(query, variables)
  }
  // Location operations
  async getLocations() {
    const query = `
      query getLocations {
        locations(first: 10) {
          edges {
            node {
              id
              name
              isActive
              address {
                address1
                address2
                city
                province
                country
                zip
              }
            }
          }
        }
      }
    `
    return this.graphql(query)
  }
  // Analytics operations
  async getShopAnalytics() {
    const query = `
      query getShop {
        shop {
          id
          name
          email
          currencyCode
          primaryDomain {
            url
          }
          billingAddress {
            country
          }
          plan {
            displayName
          }
          fulfillmentServices {
            serviceName
            type
          }
        }
      }
    `
    return this.graphql(query)
  }
  // Discount operations
  async getDiscounts(params) {
    const query = `
      query getDiscounts($first: Int!, $after: String, $query: String, $savedSearchId: ID) {
        discountNodes(first: $first, after: $after, query: $query, savedSearchId: $savedSearchId) {
          edges {
            cursor
            node {
              id
              discount {
                ... on DiscountCodeBasic {
                  title
                  status
                  startsAt
                  endsAt
                  usageLimit
                  asyncUsageCount
                  codes(first: 10) {
                    edges {
                      node {
                        code
                      }
                    }
                  }
                  customerGets {
                    value {
                      ... on DiscountPercentage {
                        percentage
                      }
                      ... on DiscountAmount {
                        amount {
                          amount
                          currencyCode
                        }
                      }
                    }
                  }
                }
                ... on DiscountAutomaticBasic {
                  title
                  status
                  startsAt
                  endsAt
                }
              }
            }
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
          }
        }
      }
    `
    const variables = {
      first: params.limit || 10,
      after: params.cursor,
      query: params.query,
      savedSearchId: params.savedSearchId,
    }
    return this.graphql(query, variables)
  }
  async createDiscountCode(params) {
    const mutation = `
      mutation createDiscountCode($basicCodeDiscount: DiscountCodeBasicInput!) {
        discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
          codeDiscountNode {
            id
            codeDiscount {
              ... on DiscountCodeBasic {
                title
                codes(first: 1) {
                  edges {
                    node {
                      code
                    }
                  }
                }
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `
    const basicCodeDiscount = {
      title: params.title,
      code: params.code,
      startsAt: params.startsAt,
      endsAt: params.endsAt,
      usageLimit: params.usageLimit,
      appliesOncePerCustomer: params.appliesOncePerCustomer,
      minimumRequirement: params.minimumRequirement,
      customerGets: params.customerGets,
      customerSelection: params.customerSelection
        ? { all: params.customerSelection === 'all' }
        : { all: true },
    }
    return this.graphql(mutation, { basicCodeDiscount })
  }
  // Fulfillment operations
  async getFulfillmentOrders(params) {
    const query = `
      query getFulfillmentOrders($first: Int!, $after: String) {
        shop {
          fulfillmentOrders(first: $first, after: $after, includeClosed: true) {
            edges {
              cursor
              node {
                id
                status
                createdAt
                updatedAt
                assignedLocation {
                  name
                }
                order {
                  id
                  name
                }
                lineItems(first: 10) {
                  edges {
                    node {
                      id
                      productTitle
                      remainingQuantity
                    }
                  }
                }
              }
            }
            pageInfo {
              hasNextPage
              hasPreviousPage
            }
          }
        }
      }
    `
    const variables = {
      first: params.limit || 10,
      after: params.cursor,
    }
    return this.graphql(query, variables)
  }
  async createFulfillment(params) {
    // Use fulfillmentCreate (fulfillmentCreateV2 is deprecated in API 2025-07+)
    const mutation = `
      mutation createFulfillment($fulfillment: FulfillmentV2Input!) {
        fulfillmentCreate(fulfillment: $fulfillment) {
          fulfillment {
            id
            status
            trackingInfo {
              number
              url
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `
    const fulfillment = {
      notifyCustomer: params.notifyCustomer,
      trackingInfo: params.trackingInfo,
      lineItemsByFulfillmentOrder: {
        fulfillmentOrderId: params.orderId,
        fulfillmentOrderLineItems: params.lineItems,
      },
    }
    return this.graphql(mutation, { fulfillment })
  }
  async getShippingZones(params) {
    const query = `
      query getShippingZones($first: Int!) {
        deliveryProfiles(first: $first) {
          edges {
            node {
              id
              name
              profileLocationGroups {
                locationGroup {
                  id
                  locations(first: 10) {
                    edges {
                      node {
                        name
                      }
                    }
                  }
                }
                locationGroupZones(first: 10) {
                  edges {
                    node {
                      zone {
                        name
                        countries {
                          code
                          name
                        }
                      }
                      methodDefinitions(first: 10) {
                        edges {
                          node {
                            name
                            rateProvider {
                              ... on DeliveryRateDefinition {
                                price {
                                  amount
                                  currencyCode
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `
    return this.graphql(query, { first: params.limit || 10 })
  }
  // Financial operations
  async getOrderTransactions(orderId) {
    const query = `
      query getOrderTransactions($id: ID!) {
        order(id: $id) {
          transactions {
            id
            kind
            status
            test
            amount
            gateway
            authorizationCode
            createdAt
          }
        }
      }
    `
    return this.graphql(query, { id: orderId })
  }
  async createRefund(params) {
    const mutation = `
      mutation createRefund($input: RefundInput!) {
        refundCreate(input: $input) {
          refund {
            id
            totalRefundedSet {
              shopMoney {
                amount
                currencyCode
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `
    const input = {
      orderId: params.orderId,
      refundLineItems: params.lineItems,
      shipping: params.shipping,
      refundDuties: params.refundDuties,
      note: params.note,
      notify: params.notify,
    }
    return this.graphql(mutation, { input })
  }
  // Gift card operations
  async getGiftCards(params) {
    const query = `
      query getGiftCards($first: Int!, $after: String, $query: String) {
        giftCards(first: $first, after: $after, query: $query) {
          edges {
            cursor
            node {
              id
              balance {
                amount
                currencyCode
              }
              initialValue {
                amount
                currencyCode
              }
              expiresOn
              lastCharacters
              createdAt
              customer {
                displayName
                email
              }
            }
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
          }
        }
      }
    `
    const variables = {
      first: params.limit || 10,
      after: params.cursor,
      query: params.query,
    }
    return this.graphql(query, variables)
  }
  async createGiftCard(params) {
    const mutation = `
      mutation createGiftCard($input: GiftCardCreateInput!) {
        giftCardCreate(input: $input) {
          giftCard {
            id
            balance {
              amount
              currencyCode
            }
            giftCardCode
          }
          userErrors {
            field
            message
          }
        }
      }
    `
    const input = {
      initialValue: params.initialValue,
      customCode: params.code,
      note: params.note,
      expiresOn: params.expiresOn,
      recipientAttributes: params.recipientEmail
        ? {
            email: params.recipientEmail,
            message: params.recipientMessage,
          }
        : undefined,
    }
    return this.graphql(mutation, { input })
  }
  // Content operations
  async getPages(params) {
    const query = `
      query getPages($first: Int!, $after: String) {
        pages(first: $first, after: $after) {
          edges {
            cursor
            node {
              id
              title
              handle
              body
              bodySummary
              createdAt
              updatedAt
              publishedAt
            }
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
          }
        }
      }
    `
    const variables = {
      first: params.limit || 10,
      after: params.cursor,
    }
    return this.graphql(query, variables)
  }
  async createPage(params) {
    const mutation = `
      mutation createPage($page: PageCreateInput!) {
        pageCreate(page: $page) {
          page {
            id
            title
            handle
          }
          userErrors {
            field
            message
          }
        }
      }
    `
    const page = {
      title: params.title,
      body: params.content,
      handle: params.handle,
      published: params.published,
      metafields: params.metafields,
    }
    return this.graphql(mutation, { page })
  }
  async getBlogs(params) {
    const query = `
      query getBlogs($first: Int!, $after: String) {
        blogs(first: $first, after: $after) {
          edges {
            cursor
            node {
              id
              title
              handle
              createdAt
            }
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
          }
        }
      }
    `
    const variables = {
      first: params.limit || 10,
      after: params.cursor,
    }
    return this.graphql(query, variables)
  }
  async createArticle(params) {
    const mutation = `
      mutation createArticle($article: ArticleCreateInput!) {
        articleCreate(article: $article) {
          article {
            id
            title
            handle
          }
          userErrors {
            field
            message
          }
        }
      }
    `
    const article = {
      blogId: params.blogId,
      title: params.title,
      contentHtml: params.content,
      summary: params.summary,
      tags: params.tags,
      published: params.published,
      publishedAt: params.publishedAt,
      image: params.image,
    }
    return this.graphql(mutation, { article })
  }
  async createRedirect(params) {
    const mutation = `
      mutation createRedirect($urlRedirect: UrlRedirectInput!) {
        urlRedirectCreate(urlRedirect: $urlRedirect) {
          urlRedirect {
            id
            path
            target
          }
          userErrors {
            field
            message
          }
        }
      }
    `
    const urlRedirect = {
      path: params.path,
      target: params.target,
    }
    return this.graphql(mutation, { urlRedirect })
  }
  // Theme operations
  async getThemes() {
    const query = `
      query getThemes {
        themes(first: 10) {
          edges {
            node {
              id
              name
              role
              createdAt
              updatedAt
            }
          }
        }
      }
    `
    return this.graphql(query)
  }
  // Webhook operations
  async getWebhooks(params) {
    const query = `
      query getWebhooks($first: Int!, $after: String) {
        webhookSubscriptions(first: $first, after: $after) {
          edges {
            cursor
            node {
              id
              topic
              callbackUrl
              format
              createdAt
              updatedAt
            }
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
          }
        }
      }
    `
    const variables = {
      first: params.limit || 10,
      after: params.cursor,
    }
    return this.graphql(query, variables)
  }
  async createWebhook(params) {
    const mutation = `
      mutation createWebhook($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
        webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
          webhookSubscription {
            id
            topic
            callbackUrl
          }
          userErrors {
            field
            message
          }
        }
      }
    `
    const webhookSubscription = {
      callbackUrl: params.callbackUrl,
      format: params.format,
      includeFields: params.includeFields,
    }
    return this.graphql(mutation, {
      topic: params.topic,
      webhookSubscription,
    })
  }
  // Draft order operations
  async getDraftOrders(params) {
    const query = `
      query getDraftOrders($first: Int!, $after: String, $query: String) {
        draftOrders(first: $first, after: $after, query: $query) {
          edges {
            cursor
            node {
              id
              name
              createdAt
              updatedAt
              totalPrice
              currencyCode
              invoiceSentAt
              status
              customer {
                displayName
                email
              }
              lineItems(first: 10) {
                edges {
                  node {
                    title
                    quantity
                    originalUnitPrice
                  }
                }
              }
            }
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
          }
        }
      }
    `
    const variables = {
      first: params.limit || 10,
      after: params.cursor,
      query: params.query,
    }
    return this.graphql(query, variables)
  }
  async createDraftOrder(params) {
    const mutation = `
      mutation createDraftOrder($input: DraftOrderInput!) {
        draftOrderCreate(input: $input) {
          draftOrder {
            id
            name
            totalPrice
            currencyCode
          }
          userErrors {
            field
            message
          }
        }
      }
    `
    const input = {
      lineItems: params.lineItems,
      customerId: params.customerId,
      email: params.email,
      note: params.note,
      tags: params.tags,
      shippingAddress: params.shippingAddress,
      billingAddress: params.billingAddress,
    }
    return this.graphql(mutation, { input })
  }
  // Metaobject operations (GraphQL exclusive)
  async getMetaobjects(params) {
    const query = `
      query getMetaobjects($type: String!, $first: Int!, $after: String) {
        metaobjects(type: $type, first: $first, after: $after) {
          edges {
            cursor
            node {
              id
              type
              handle
              updatedAt
              fields {
                key
                value
              }
            }
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
          }
        }
      }
    `
    const variables = {
      type: params.type,
      first: params.limit || 10,
      after: params.cursor,
    }
    return this.graphql(query, variables)
  }
  async createMetaobject(params) {
    const mutation = `
      mutation createMetaobject($metaobject: MetaobjectCreateInput!) {
        metaobjectCreate(metaobject: $metaobject) {
          metaobject {
            id
            type
            handle
          }
          userErrors {
            field
            message
          }
        }
      }
    `
    const metaobject = {
      type: params.type,
      fields: params.fields,
    }
    return this.graphql(mutation, { metaobject })
  }
  // Markets operations
  async getMarkets(params) {
    const query = `
      query getMarkets($first: Int!) {
        markets(first: $first) {
          edges {
            node {
              id
              name
              handle
              enabled
              primary
              regions(first: 10) {
                edges {
                  node {
                    ... on Country {
                      code
                      name
                    }
                  }
                }
              }
              webPresence {
                defaultLocale
                alternateLocales
                domain {
                  url
                }
              }
            }
          }
        }
      }
    `
    return this.graphql(query, { first: params.limit || 10 })
  }
  // Price rules operations (migrated from deprecated priceRules to discountNodes)
  async getPriceRules(params) {
    // Using discountNodes instead of deprecated priceRules query
    const query = `
      query getPriceRules($first: Int!, $after: String) {
        discountNodes(first: $first, after: $after) {
          edges {
            cursor
            node {
              id
              discount {
                ... on DiscountCodeBasic {
                  __typename
                  title
                  status
                  startsAt
                  endsAt
                  usageLimit
                  asyncUsageCount
                  combinesWith {
                    orderDiscounts
                    productDiscounts
                    shippingDiscounts
                  }
                  customerGets {
                    value {
                      ... on DiscountPercentage {
                        percentage
                      }
                      ... on DiscountAmount {
                        amount {
                          amount
                          currencyCode
                        }
                      }
                    }
                    items {
                      ... on AllDiscountItems {
                        allItems
                      }
                    }
                  }
                }
                ... on DiscountCodeBxgy {
                  __typename
                  title
                  status
                  startsAt
                  endsAt
                  usageLimit
                  asyncUsageCount
                }
                ... on DiscountCodeFreeShipping {
                  __typename
                  title
                  status
                  startsAt
                  endsAt
                  usageLimit
                  asyncUsageCount
                }
                ... on DiscountAutomaticBasic {
                  __typename
                  title
                  status
                  startsAt
                  endsAt
                  asyncUsageCount
                  combinesWith {
                    orderDiscounts
                    productDiscounts
                    shippingDiscounts
                  }
                  customerGets {
                    value {
                      ... on DiscountPercentage {
                        percentage
                      }
                      ... on DiscountAmount {
                        amount {
                          amount
                          currencyCode
                        }
                      }
                    }
                  }
                }
                ... on DiscountAutomaticBxgy {
                  __typename
                  title
                  status
                  startsAt
                  endsAt
                  asyncUsageCount
                }
                ... on DiscountAutomaticFreeShipping {
                  __typename
                  title
                  status
                  startsAt
                  endsAt
                  asyncUsageCount
                }
              }
            }
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
          }
        }
      }
    `
    const variables = {
      first: params.limit || 10,
      after: params.cursor,
    }
    return this.graphql(query, variables)
  }
  // Abandoned checkout operations
  async getAbandonedCheckouts(params) {
    const query = `
      query getAbandonedCheckouts($first: Int!, $after: String, $query: String) {
        abandonedCheckouts(first: $first, after: $after, query: $query) {
          edges {
            cursor
            node {
              id
              createdAt
              updatedAt
              totalPrice
              currencyCode
              customer {
                displayName
                email
              }
              lineItems(first: 10) {
                edges {
                  node {
                    title
                    quantity
                    price
                  }
                }
              }
            }
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
          }
        }
      }
    `
    const variables = {
      first: params.limit || 10,
      after: params.cursor,
      query: params.query,
    }
    return this.graphql(query, variables)
  }
  // Reports and analytics operations
  async getSalesReport(params) {
    // Validate inputs
    const granularity = this.validateGranularity(params.granularity)
    const startDate = this.validateShopifyDate(params.startDate) || '-30d'
    const endDate = this.validateShopifyDate(params.endDate) || 'today'
    // Use ShopifyQL for sales analytics
    // Available metrics: orders, average_order_value, total_sales, gross_sales, net_sales, discounts, returns, taxes
    const shopifyqlQuery = `
            FROM sales
            SHOW total_sales, net_sales, gross_sales, orders, average_order_value, discounts, taxes, returns
            GROUP BY ${granularity}
            SINCE ${startDate}
            UNTIL ${endDate}
            ORDER BY ${granularity} ASC
        `
    return this.executeShopifyQL(shopifyqlQuery)
  }
  async getProductAnalytics(params) {
    // Validate inputs
    const startDate = this.validateShopifyDate(params.startDate) || '-30d'
    const endDate = this.validateShopifyDate(params.endDate) || 'today'
    const limit = this.validatePositiveInt(params.limit, 'limit', 50)
    // Use ShopifyQL for product sales analytics
    // Note: There's no 'products' table in ShopifyQL. Use 'sales' with GROUP BY product_title
    // Metrics are automatically aggregated when using GROUP BY (no need for sum())
    const shopifyqlQuery = `
            FROM sales
            SHOW product_title, net_sales, gross_sales, orders
            GROUP BY product_title
            SINCE ${startDate}
            UNTIL ${endDate}
            ORDER BY net_sales DESC
            LIMIT ${limit}
        `
    // Execute ShopifyQL query for sales data
    const salesResult = await this.executeShopifyQL(shopifyqlQuery)
    // Also fetch product details for inventory info
    const productQuery = `
      query getProductDetails($limit: Int!) {
        products(first: $limit, sortKey: UPDATED_AT, reverse: true) {
          edges {
            node {
              id
              title
              totalInventory
              priceRangeV2 {
                minVariantPrice {
                  amount
                  currencyCode
                }
              }
              tracksInventory
            }
          }
        }
      }
    `
    const productResult = await this.graphql(productQuery, { limit })
    // Combine results
    return {
      data: {
        shopifyqlQuery: salesResult.data?.shopifyqlQuery,
        products: productResult.data?.products,
      },
    }
  }
  async getCustomerAnalytics(params) {
    // Validate inputs
    const limit = this.validatePositiveInt(params?.limit, 'limit', 100)
    const query = `
      query getCustomerAnalytics($limit: Int!) {
        customers(first: $limit, sortKey: TOTAL_SPENT, reverse: true) {
          edges {
            node {
              id
              numberOfOrders
              amountSpent {
                amount
                currencyCode
              }
              createdAt
            }
          }
          pageInfo {
            hasNextPage
          }
        }
      }
    `
    return this.graphql(query, { limit })
  }
  async getInventoryReport(_params) {
    const query = `
      query getInventoryReport {
        products(first: 100) {
          edges {
            node {
              id
              title
              totalInventory
              tracksInventory
              variants(first: 10) {
                edges {
                  node {
                    inventoryQuantity
                    sku
                  }
                }
              }
            }
          }
        }
      }
    `
    return this.graphql(query)
  }
  async getMarketingReport(_params) {
    const query = `
      query getMarketingReport {
        marketingActivities(first: 50) {
          edges {
            node {
              id
              title
              status
              budget {
                budgetType
                total {
                  amount
                  currencyCode
                }
              }
              marketingChannel
              createdAt
            }
          }
        }
      }
    `
    return this.graphql(query)
  }
  async getFinancialSummary(params) {
    // Validate and convert dates to ISO format for GraphQL search query
    const { startDate, endDate } = this.getISODateRange(params)
    const gqlQuery = `
      query getFinancialSummary($query: String!) {
        orders(first: ${ShopifyClient.SHOPIFY_MAX_LIMIT}, query: $query) {
          edges {
            node {
              totalPriceSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
              totalTaxSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
              totalShippingPriceSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
              refunds {
                totalRefundedSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
              }
              createdAt
            }
          }
          pageInfo {
            hasNextPage
          }
        }
      }
    `
    const searchQuery = `created_at:>='${startDate}' AND created_at:<='${endDate}'`
    return this.graphql(gqlQuery, { query: searchQuery })
  }
  async getConversionReport(params) {
    // Validate inputs
    const startDate = this.validateShopifyDate(params.startDate) || '-30d'
    const endDate = this.validateShopifyDate(params.endDate) || 'today'
    // NOTE: Session/visitor data (total_sessions, total_visitors, conversion_rate) is NOT available
    // via the ShopifyQL API. This data is only accessible in the Shopify Admin interface.
    // This report provides sales-based metrics only.
    // Query sales for conversion-related data
    const salesQuery = `
            FROM sales
            SHOW orders, average_order_value, total_sales, gross_sales, net_sales
            SINCE ${startDate}
            UNTIL ${endDate}
        `
    const salesResult = await this.executeShopifyQL(salesQuery)
    // Also fetch shop metadata
    const shopQuery = `
      query getShopMetadata {
        shop {
          productTypes(first: 50) {
            edges {
              node
            }
          }
          productVendors(first: 50) {
            edges {
              node
            }
          }
        }
      }
    `
    const shopResult = await this.graphql(shopQuery)
    // Combine results
    return {
      data: {
        // Note: sessions data not available via API
        sessions: null,
        sessionsNotice:
          'Session/visitor data is not available via the ShopifyQL API. Access this data through the Shopify Admin interface.',
        sales: salesResult.data?.shopifyqlQuery,
        shop: shopResult.data?.shop,
      },
    }
  }
  async getAbandonmentReport(params) {
    // Validate inputs and convert dates to ISO format for GraphQL search query
    const limit = this.validatePositiveInt(params.limit, 'limit', 100)
    const { startDate, endDate } = this.getISODateRange(params)
    // Build the query string for date filtering
    const queryString = `created_at:>='${startDate}' AND created_at:<='${endDate}'`
    const query = `
      query getAbandonmentReport($queryString: String!, $limit: Int!) {
        abandonedCheckouts(first: $limit, query: $queryString) {
          edges {
            node {
              id
              createdAt
              totalPriceSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
              lineItems(first: 10) {
                edges {
                  node {
                    quantity
                  }
                }
              }
            }
          }
          pageInfo {
            hasNextPage
          }
        }
      }
    `
    return this.graphql(query, { queryString, limit })
  }
  async getTrafficReport(params) {
    // IMPORTANT: Session and visitor traffic data (total_sessions, total_visitors,
    // returning_visitor_count, new_visitor_count) is NOT available via the ShopifyQL API.
    // This data is only accessible through the Shopify Admin interface.
    //
    // As an alternative, we return sales activity data grouped by time period,
    // which can indicate store activity trends.
    // Validate inputs
    const startDate = this.validateShopifyDate(params.startDate) || '-30d'
    const endDate = this.validateShopifyDate(params.endDate) || 'today'
    const granularity = this.validateGranularity(params.granularity)
    // Use sales data as a proxy for activity (sessions data not available via API)
    // Available columns: orders, total_sales, gross_sales, net_sales, average_order_value, discounts, taxes, returns
    const shopifyqlQuery = `
            FROM sales
            SHOW orders, total_sales, gross_sales, net_sales
            GROUP BY ${granularity}
            SINCE ${startDate}
            UNTIL ${endDate}
            ORDER BY ${granularity} ASC
        `
    const result = await this.executeShopifyQL(shopifyqlQuery)
    // Add notice about traffic data limitation
    return {
      data: {
        shopifyqlQuery: result.data?.shopifyqlQuery,
        notice:
          'Traffic data (sessions, visitors) is not available via the ShopifyQL API. This report shows sales activity as a proxy for store traffic. Access full traffic data through the Shopify Admin interface.',
      },
    }
  }
  async getCustomReport(_params) {
    // Custom report implementation would depend on specific requirements
    const query = `
      query getCustomReport {
        shop {
          id
          name
        }
      }
    `
    return this.graphql(query)
  }
  // B2B operations
  async getCompanies(params) {
    const query = `
      query getCompanies($first: Int!, $after: String) {
        companies(first: $first, after: $after) {
          edges {
            cursor
            node {
              id
              name
              externalId
              note
              createdAt
              updatedAt
              customerCount
              mainContact {
                customer {
                  displayName
                  email
                }
              }
            }
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
          }
        }
      }
    `
    const variables = {
      first: params.limit || 10,
      after: params.cursor,
    }
    return this.graphql(query, variables)
  }
  async createCompany(params) {
    const mutation = `
      mutation createCompany($input: CompanyCreateInput!) {
        companyCreate(input: $input) {
          company {
            id
            name
          }
          userErrors {
            field
            message
          }
        }
      }
    `
    const input = {
      company: {
        name: params.name,
        externalId: params.externalId,
        note: params.note,
      },
      companyContact: params.contactEmail
        ? {
            email: params.contactEmail,
            phone: params.contactPhone,
          }
        : undefined,
    }
    return this.graphql(mutation, { input })
  }
}
//# sourceMappingURL=shopify-client.js.map
