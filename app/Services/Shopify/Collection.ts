import type { Collection as ShopifyCollection } from 'Types/Collection'
import Authentication from './Authentication'

export default class Collection extends Authentication {
  public async getAll(): Promise<ShopifyCollection[]> {
    const allCollections = [] as any[]
    let cursor = null
    let hasNextPage = true

    while (hasNextPage) {
      const { query, variables } = this.getAllCollectionsQuery(cursor)
      const collectionsData = await this.fetchGraphQL(query, variables)
      const collections = collectionsData.collections.edges

      // Store the current products
      collections.forEach((collection) => allCollections.push(collection.node))

      // Check for next page
      hasNextPage = collectionsData.collections.pageInfo.hasNextPage

      // Get the last cursor
      if (hasNextPage) {
        cursor = collections[collections.length - 1].cursor
      }
    }

    return allCollections
  }

  private getAllCollectionsQuery(cursor: string | null = null) {
    return {
      query: `query GetAllCollections($cursor: String) {
                collections(first: 250, after: $cursor, query: "published_status:published") {
                  edges {
                    node {
                      id
                      title
                      description
                      handle
                      image {
                        id
                        altText
                      }
                      metafields(first: 10) {
                        edges {
                          node {
                            namespace
                            key
                            reference {
                              ... on Collection {
                                title
                              }
                              ...on Metaobject {
                                id
                                type
                                field(key: "alts") {
                                  key
                                  jsonValue
                                }
                              }
                            }
                          }
                        }
                      }
                      seo {
                        title
                        description
                      }
                    }
                    cursor
                  }
                  pageInfo {
                    hasNextPage
                  }
                }
              }`,
      variables: { cursor },
    }
  }

  public async createMediaMetaObject(mediaAlts: string[]) {
    const { query, variables } = this.getcreateMediaMetaObjectQuery(mediaAlts)
    const response = await this.fetchGraphQL(query, variables)
    return response.metaobjectCreate
  }

  private getcreateMediaMetaObjectQuery(mediaAlts: string[]) {
    return {
      query: `mutation CreateMetaobject($metaobject: MetaobjectCreateInput!) {
        metaobjectCreate(metaobject: $metaobject) {
          metaobject {
            id
          }
          userErrors {
            field
            message
            code
          }
        }
      }`,
      variables: {
        metaobject: {
          type: 'media',
          fields: [
            {
              key: 'alts',
              value: JSON.stringify(mediaAlts),
            },
          ],
        },
      },
    }
  }

  public async updateAltTextsMetaObject(id: string, newValues: string[]) {
    const { query, variables } = this.getUpdateAltTextsMetaObjectQuery(id, newValues)
    const response = await this.fetchGraphQL(query, variables)
    return response.metaobjectUpdate
  }

  private getUpdateAltTextsMetaObjectQuery(id: string, newValues: string[]) {
    return {
      query: `mutation UpdateMetaobject($id: ID!, $metaobject: MetaobjectUpdateInput!) {
        metaobjectUpdate(id: $id, metaobject: $metaobject) {
          metaobject {
            id
          }
          userErrors {
            field
            message
            code
          }
        }
      }`,
      variables: {
        id,
        metaobject: {
          fields: [
            {
              key: 'alts',
              value: JSON.stringify(newValues),
            },
          ],
        },
      },
    }
  }

  public async update(collectionId: string, newValues: any) {
    const { query, variables } = this.getUpdateQuery(collectionId, newValues)
    const response = await this.fetchGraphQL(query, variables)
    return response.collectionUpdate.collection
  }

  private getUpdateQuery(collectionId: string, newValues: any) {
    return {
      query: `mutation CollectionUpdate($input: CollectionInput!) {
        collectionUpdate(input: $input) {
          collection {
            id
          }
        }
      }`,
      variables: {
        input: {
          id: isNaN(Number(collectionId))
            ? collectionId
            : `gid://shopify/Collection/${collectionId}`,
          redirectNewHandle: true,
          ...newValues,
        },
      },
    }
  }
}
