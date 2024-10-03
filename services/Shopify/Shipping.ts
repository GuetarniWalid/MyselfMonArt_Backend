import Authentication from './Authentication'

export default class Shipping extends Authentication {
  public async getDefaultDetails() {
    const { query } = this.getDefaultDetailsQuery()
    const shippingDetailsData = await this.fetchGraphQL(query)
    const shippingDetails = shippingDetailsData.deliveryProfiles.nodes
    const defaultShippingDetails = shippingDetails.find((d) => d.default)
    return defaultShippingDetails
  }

  private getDefaultDetailsQuery() {
    return {
      query: ` {
                deliveryProfiles(first: 10) {
                  nodes {
                    name
                    default
                    profileLocationGroups {
                      locationGroupZones(first: 10) {
                        nodes {
                          methodDefinitions(first: 10) {
                            nodes {
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
                          zone {
                            countries {
                              code {
                                countryCode
                              }
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
