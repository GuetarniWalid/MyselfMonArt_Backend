import Authentication from './Authentication'

export default class Metafield extends Authentication {
  public async increment(productId: number, namespace: string, key: string) {
    return this.adjustValueByOne(productId, namespace, key, 1)
  }

  public async decrement(productId: number, namespace: string, key: string) {
    return this.adjustValueByOne(productId, namespace, key, -1)
  }

  private async adjustValueByOne(
    productId: number,
    namespace: string,
    key: string,
    addedValue: 1 | -1
  ) {
    try {
      const [metafieldID, count] = await this.getMetafieldData(productId, namespace, key)
      if (!metafieldID) {
        throw new Error('Metafield not found')
      }
      const response = await this.client.request({
        method: 'PUT',
        url: `/products/${productId}/metafields/${metafieldID}.json`,
        data: {
          metafield: {
            id: metafieldID,
            value: count + addedValue,
          },
        },
      })
      return response.data.metafield.value as number
    } catch (e) {
      this.createMetafield(productId, namespace, key)
    }
  }

  private async getMetafieldData(productId: number, namespace: string, key: string) {
    const response = await this.client.request({
      method: 'GET',
      url: `/products/${productId}/metafields.json`,
    })
    const metafields = response.data.metafields
    const metafield = metafields.find(
      (metafield) => metafield.namespace === namespace && metafield.key === key
    )
    return [metafield.id as number, metafield.value as number] as const
  }

  private async createMetafield(productId: number, namespace: string, key: string) {
    const response = await this.client.request({
      method: 'POST',
      url: `/products/${productId}/metafields.json`,
      data: {
        metafield: {
          namespace,
          key,
          value: 1,
          type: 'number_integer',
        },
      },
    })
    return response.data.value as number
  }

  public async update(ownerId: string, namespace: string, key: string, value: any) {
    const { query, variables } = this.updateQuery(ownerId, namespace, key, value)
    const response = await this.fetchGraphQL(query, variables)

    if (response.metafieldsSet.userErrors?.length) {
      throw new Error(response.metafieldsSet.userErrors[0].message)
    }

    return response.metafieldsSet.metafields
  }

  private updateQuery(ownerId: string, namespace: string, key: string, value: any) {
    return {
      query: `mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
                metafieldsSet(metafields: $metafields) {
                  metafields {
                    key
                    namespace
                    value
                  }
                  userErrors {
                    field
                    message
                    code
                  }
                }
              }`,
      variables: {
        metafields: [
          {
            ownerId,
            namespace,
            key,
            value,
          },
        ],
      },
    }
  }
}
