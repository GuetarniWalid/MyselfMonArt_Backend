import type { Publication } from 'Types/Publication'
import Authentication from './Authentication'

export default class Publications extends Authentication {
  private async getAll(): Promise<Publication[]> {
    const { query } = this.getAllPublicationsQuery()
    const response = await this.fetchGraphQL(query)
    return response.publications.edges.map((edge: any) => edge.node)
  }

  private getAllPublicationsQuery() {
    return {
      query: `query GetPublications {
        publications(first: 50) {
          edges {
            node {
              id
              name
              app {
                id
                title
              }
            }
          }
        }
      }`,
      variables: {},
    }
  }

  public async publishProductOnAll(productId: string): Promise<void> {
    const publications = await this.getAll()

    // Publier le produit sur chaque publication
    const publishPromises = publications.map((publication) =>
      this.publishProduct(productId, publication.id)
    )

    await Promise.all(publishPromises)
  }

  private async publishProduct(productId: string, publicationId: string): Promise<void> {
    const { query, variables } = this.getPublishProductQuery(productId, publicationId)
    const response = await this.fetchGraphQL(query, variables)

    if (response.publishablePublish.userErrors?.length) {
      console.warn(
        `Failed to publish product ${productId} on publication ${publicationId}:`,
        response.publishablePublish.userErrors[0].message
      )
    }
  }

  private getPublishProductQuery(productId: string, publicationId: string) {
    return {
      query: `mutation PublishablePublish($id: ID!, $publicationId: ID!) {
        publishablePublish(id: $id, input: {publicationId: $publicationId}) {
          publishable {
            publishedOnPublication(publicationId: $publicationId)
          }
          userErrors {
            field
            message
          }
        }
      }`,
      variables: {
        id: isNaN(Number(productId)) ? productId : `gid://shopify/Product/${productId}`,
        publicationId,
      },
    }
  }
}
