import Authentication from './Authentication'

export interface OrderTracking {
  number: string | null
  url: string | null
  company: string | null
}

export interface OrderStatus {
  id: string // Shopify order GID — needed for mutations (e.g. address update)
  name: string
  createdAt: string
  fulfillmentStatus: string
  financialStatus: string
  itemTitles: string[]
  tracking: OrderTracking[]
  countryCode: string | null // internal use (estimate the delay by zone); not for display
  statusPageUrl: string | null // Shopify order status page: localized, links to the real carrier
}

export default class Order extends Authentication {
  /**
   * Look up an order by the customer's email OR order number (e.g. "1801" or
   * "#1801"). Identity is proven by the email/number the customer supplies, so
   * we never need their DM name. Returns the most recent matching order's
   * status + tracking — intentionally WITHOUT the shipping address or other PII
   * beyond what's needed to answer "where is my order?".
   */
  public async findForCustomer(params: {
    email?: string
    orderNumber?: string
  }): Promise<OrderStatus | null> {
    const clauses: string[] = []
    if (params.email) {
      const email = params.email.trim().toLowerCase().replace(/["\\]/g, '')
      if (email) clauses.push(`email:${email}`)
    }
    if (params.orderNumber) {
      const num = params.orderNumber.trim().replace(/[^0-9]/g, '')
      if (num) clauses.push(`name:#${num}`)
    }
    if (clauses.length === 0) return null

    // OR the clauses so either identifier finds the order.
    const search = clauses.join(' OR ')
    const query = `query FindOrder($q: String!) {
      orders(first: 1, query: $q, sortKey: CREATED_AT, reverse: true) {
        edges {
          node {
            id
            name
            createdAt
            statusPageUrl
            displayFulfillmentStatus
            displayFinancialStatus
            shippingAddress { countryCodeV2 }
            lineItems(first: 10) { edges { node { title } } }
            fulfillments(first: 5) { trackingInfo { number url company } }
          }
        }
      }
    }`
    const data = await this.fetchGraphQL(query, { q: search })
    const node = data.orders?.edges?.[0]?.node
    if (!node) return null

    const tracking: OrderTracking[] = []
    for (const f of node.fulfillments ?? []) {
      for (const t of f.trackingInfo ?? []) {
        tracking.push({ number: t.number ?? null, url: t.url ?? null, company: t.company ?? null })
      }
    }

    return {
      id: node.id,
      name: node.name,
      createdAt: node.createdAt,
      fulfillmentStatus: node.displayFulfillmentStatus,
      financialStatus: node.displayFinancialStatus,
      itemTitles: (node.lineItems?.edges ?? []).map((e: any) => e.node.title).filter(Boolean),
      tracking,
      countryCode: node.shippingAddress?.countryCodeV2 ?? null,
      statusPageUrl: node.statusPageUrl ?? null,
    }
  }

  /**
   * Update an order's shipping address. ONLY safe before fulfillment — the
   * caller (updateOrderAddress tool) is responsible for identity verification
   * and the not-yet-shipped check. Performs the orderUpdate mutation and
   * surfaces Shopify userErrors as a thrown error.
   */
  public async updateShippingAddress(
    orderId: string,
    address: {
      address1: string
      address2?: string
      city: string
      provinceCode?: string
      countryCode: string
      zip: string
      firstName?: string
      lastName?: string
    }
  ): Promise<void> {
    const gid = orderId.startsWith('gid://') ? orderId : `gid://shopify/Order/${orderId}`
    const shippingAddress: Record<string, string> = {
      address1: address.address1,
      city: address.city,
      countryCode: address.countryCode,
      zip: address.zip,
    }
    if (address.address2) shippingAddress.address2 = address.address2
    if (address.provinceCode) shippingAddress.provinceCode = address.provinceCode
    if (address.firstName) shippingAddress.firstName = address.firstName
    if (address.lastName) shippingAddress.lastName = address.lastName

    const mutation = `mutation OrderUpdate($input: OrderInput!) {
      orderUpdate(input: $input) {
        order { id }
        userErrors { field message }
      }
    }`
    const data = await this.fetchGraphQL(mutation, { input: { id: gid, shippingAddress } })
    const errors = data.orderUpdate?.userErrors
    if (errors && errors.length) {
      throw new Error(errors[0].message ?? 'orderUpdate failed')
    }
  }

  /**
   * Ajoute des tags à une commande (mutation tagsAdd : idempotente — n'écrase pas les tags
   * existants et ne crée pas de doublon). Les tags sont des métadonnées ADMIN : visibles et
   * filtrables dans l'admin Shopify, JAMAIS exposés au client (panier, checkout, emails,
   * page de suivi). Surface les userErrors Shopify en exception.
   */
  public async addTags(orderId: string, tags: string[]): Promise<void> {
    const clean = [...new Set(tags.map((t) => t.trim()).filter(Boolean))]
    if (clean.length === 0) return
    const gid = orderId.startsWith('gid://') ? orderId : `gid://shopify/Order/${orderId}`
    const mutation = `mutation OrderTagsAdd($id: ID!, $tags: [String!]!) {
      tagsAdd(id: $id, tags: $tags) {
        node { id }
        userErrors { field message }
      }
    }`
    const data = await this.fetchGraphQL(mutation, { id: gid, tags: clean })
    const errors = data.tagsAdd?.userErrors
    if (errors && errors.length) {
      throw new Error(errors[0].message ?? 'tagsAdd failed')
    }
  }
}
