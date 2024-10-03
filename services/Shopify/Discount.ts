import Authentication from './Authentication'

export default class Discount extends Authentication {
  public async getDiscounts() {
    const { query } = this.getDiscountsQuery()
    const discountsData = await this.fetchGraphQL(query)
    const discountsDetails = discountsData.automaticDiscountNodes.nodes
    return discountsDetails
  }

  private getDiscountsQuery() {
    return {
      query: ` {
                automaticDiscountNodes(first: 10, query: "status:ACTIVE") {
                  nodes {
                    automaticDiscount {
                      ... on DiscountAutomaticBasic {
                        startsAt
                        endsAt
                        shortSummary
                        title
                        customerGets {
                          value {
                            ... on DiscountAmount {
                              amount {
                                amount
                                currencyCode
                              }
                            }
                              ... on DiscountPercentage {
                                percentage
                              }
                          }
                        }
                      }
                    }                  
                  }
                }
              }`,
    }
  }
}
