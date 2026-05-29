import Authentication from './Authentication'

export interface ShippingZoneInfo {
  zoneName: string
  countryCodes: string[]
  restOfWorld: boolean
  methodName: string | null
  delay: string | null // the method description, where the merchant stores the delay
  price: string | null
  currency: string | null
}

export default class Shipping extends Authentication {
  /**
   * Flattened view of the default delivery profile's zones for conversational
   * use: which countries each zone serves, plus the active method's name,
   * description (where we store the delivery delay) and price.
   */
  public async getZonesForBot(): Promise<ShippingZoneInfo[]> {
    const query = `{
      deliveryProfiles(first: 5) {
        nodes {
          default
          profileLocationGroups {
            locationGroupZones(first: 30) {
              nodes {
                zone { name countries { restOfWorld code { countryCode } } }
                methodDefinitions(first: 10) {
                  nodes {
                    name
                    description
                    active
                    rateProvider {
                      ... on DeliveryRateDefinition { price { amount currencyCode } }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }`
    const data = await this.fetchGraphQL(query)
    const profiles = data.deliveryProfiles.nodes
    const profile = profiles.find((p: any) => p.default) ?? profiles[0]
    if (!profile) return []

    const zones: ShippingZoneInfo[] = []
    for (const group of profile.profileLocationGroups ?? []) {
      for (const z of group.locationGroupZones?.nodes ?? []) {
        const countries = z.zone?.countries ?? []
        const method =
          (z.methodDefinitions?.nodes ?? []).find((m: any) => m.active) ??
          z.methodDefinitions?.nodes?.[0]
        const price = method?.rateProvider?.price
        zones.push({
          zoneName: z.zone?.name ?? '',
          countryCodes: countries.map((c: any) => c.code?.countryCode).filter(Boolean),
          restOfWorld: countries.some((c: any) => c.restOfWorld === true),
          methodName: method?.name ?? null,
          delay: method?.description ?? null,
          price: price?.amount ?? null,
          currency: price?.currencyCode ?? null,
        })
      }
    }
    return zones
  }

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
