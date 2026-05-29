import Authentication from './Authentication'

export interface OrderTracking {
  number: string | null
  url: string | null
  company: string | null
}

export interface OrderStatus {
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
}
