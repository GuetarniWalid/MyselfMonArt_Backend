import Authentication from './Authentication'

export default class Metafield extends Authentication {
  private endpointBase: string

  constructor(resource: 'products', resourceId: number) {
    super()
    this.endpointBase = `${resource}/${resourceId}`
  }

  public async increment(namespace: string, key: string) {
    return this.adjustValueByOne(namespace, key, 1)
  }

  public async decrement(namespace: string, key: string) {
    return this.adjustValueByOne(namespace, key, -1)
  }

  private async adjustValueByOne(namespace: string, key: string, addedValue: 1 | -1) {
    try {
      const [metafieldID, count] = await this.getMetafieldData(namespace, key)
      if (!metafieldID) {
        throw new Error('Metafield not found')
      }
      const response = await this.client.request({
        method: 'PUT',
        url: `/${this.endpointBase}/metafields/${metafieldID}.json`,
        data: {
          metafield: {
            id: metafieldID,
            value: count + addedValue,
          },
        },
      })
      return response.data.metafield.value as number
    } catch (e) {
      this.createMetafield(namespace, key)
    }
  }

  private async getMetafieldData(namespace: string, key: string) {
    const response = await this.client.request({
      method: 'GET',
      url: `/${this.endpointBase}/metafields.json`,
    })
    const metafields = response.data.metafields
    const metafield = metafields.find(
      (metafield) => metafield.namespace === namespace && metafield.key === key
    )
    return [metafield.id as number, metafield.value as number] as const
  }

  private async createMetafield(namespace: string, key: string) {
    const response = await this.client.request({
      method: 'POST',
      url: `/${this.endpointBase}/metafields.json`,
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
}
