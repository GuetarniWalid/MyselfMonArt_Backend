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

  // Video metafield helpers
  private readonly VIDEO_NAMESPACE = 'video'
  private readonly VIDEO_URL_KEY = 'url'
  private readonly VIDEO_ALT_KEY = 'alt'

  /**
   * Get the video URL from a product's metafield
   * @param productId - The product GID (e.g., gid://shopify/Product/123)
   * @returns The video URL or null if not set
   */
  public async getVideoUrl(productId: string): Promise<string | null> {
    const query = `
      query GetProductVideoUrl($id: ID!) {
        product(id: $id) {
          metafield(namespace: "${this.VIDEO_NAMESPACE}", key: "${this.VIDEO_URL_KEY}") {
            value
          }
        }
      }
    `

    const response = await this.fetchGraphQL(query, { id: productId })
    return response.product?.metafield?.value || null
  }

  /**
   * Set the video URL metafield on a product
   * @param productId - The product GID (e.g., gid://shopify/Product/123)
   * @param url - The video CDN URL
   */
  public async setVideoUrl(productId: string, url: string): Promise<void> {
    console.log(`📝 Setting video URL metafield for product ${productId}`)
    console.log(`   🔗 URL: ${url}`)

    await this.update(productId, this.VIDEO_NAMESPACE, this.VIDEO_URL_KEY, url)

    console.log(`   ✅ Metafield updated successfully`)
  }

  /**
   * Set the video alt text metafield on a product
   * @param productId - The product GID (e.g., gid://shopify/Product/123)
   * @param alt - The video alt text for accessibility
   */
  public async setVideoAlt(productId: string, alt: string): Promise<void> {
    console.log(`📝 Setting video alt metafield for product ${productId}`)
    console.log(`   📄 Alt: ${alt.substring(0, 50)}...`)

    await this.update(productId, this.VIDEO_NAMESPACE, this.VIDEO_ALT_KEY, alt)

    console.log(`   ✅ Video alt metafield updated successfully`)
  }

  /**
   * Delete the video alt text metafield from a product
   * @param productId - The product GID (e.g., gid://shopify/Product/123)
   */
  public async deleteVideoAlt(productId: string): Promise<void> {
    console.log(`🗑️  Deleting video alt metafield for product ${productId}`)

    const query = `
      mutation MetafieldsDelete($metafields: [MetafieldIdentifierInput!]!) {
        metafieldsDelete(metafields: $metafields) {
          deletedMetafields {
            key
            namespace
          }
          userErrors {
            field
            message
          }
        }
      }
    `

    const variables = {
      metafields: [
        {
          ownerId: productId,
          namespace: this.VIDEO_NAMESPACE,
          key: this.VIDEO_ALT_KEY,
        },
      ],
    }

    try {
      const response = await this.fetchGraphQL(query, variables)

      if (response.metafieldsDelete?.userErrors?.length) {
        console.warn(
          `⚠️  Error deleting video alt metafield: ${response.metafieldsDelete.userErrors[0].message}`
        )
      } else {
        console.log(`   ✅ Video alt metafield deleted successfully`)
      }
    } catch (error) {
      // Ignore errors - metafield might not exist
      console.log(`   ℹ️  Video alt metafield may not exist, skipping deletion`)
    }
  }
}
