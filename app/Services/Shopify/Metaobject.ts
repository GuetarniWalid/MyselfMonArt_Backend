import type { Metaobject as ShopifyMetaobject } from 'Types/Metaobject'
import Authentication from './Authentication'

export default class Metaobject extends Authentication {
  public async getAll(type: string): Promise<ShopifyMetaobject[]> {
    const allMetaobjects = [] as ShopifyMetaobject[]
    let cursor = null
    let hasNextPage = true

    while (hasNextPage) {
      const { query, variables } = this.getAllMetaobjectsQuery(cursor, type)
      const metaobjectsData = await this.fetchGraphQL(query, variables)
      const metaobjects = metaobjectsData.metaobjects.edges

      // Store the current metaobjects
      metaobjects.forEach((metaobject) => allMetaobjects.push(metaobject.node))

      // Check for next page
      hasNextPage = metaobjectsData.metaobjects.pageInfo.hasNextPage

      // Get the last cursor
      if (hasNextPage) {
        cursor = metaobjects[metaobjects.length - 1].cursor
      }
    }

    return allMetaobjects
  }

  private getAllMetaobjectsQuery(cursor: string | null = null, type: string) {
    return {
      query: `query GetAllMetaobjects($cursor: String, $type: String!) {
        metaobjects(first: 250, after: $cursor, type: $type) {
          edges {
            node {
              id
              handle
              type
              capabilities {
                publishable {
                  status
                }
              }
              fields {
                key
                value
              }
            }
            cursor
          }
          pageInfo {
            hasNextPage
          }
        }
      }`,
      variables: { cursor, type },
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
          capabilities: {
            publishable: {
              status: 'ACTIVE',
            },
          },
        },
      },
    }
  }

  public async createThemeMetaobject(label: string) {
    const { query, variables } = this.getCreateThemeMetaobjectQuery(label)
    const response = await this.fetchGraphQL(query, variables)
    return response.metaobjectCreate
  }

  private getCreateThemeMetaobjectQuery(label: string) {
    return {
      query: `mutation CreateThemeMetaobject($metaobject: MetaobjectCreateInput!) {
        metaobjectCreate(metaobject: $metaobject) {
          metaobject {
            id
            handle
            fields {
              key
              value
            }
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
          type: 'shopify--theme',
          fields: [
            {
              key: 'label',
              value: label,
            },
            {
              key: 'taxonomy_reference',
              value: 'gid://shopify/TaxonomyValue/7722',
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
          capabilities: {
            publishable: {
              status: 'ACTIVE',
            },
          },
        },
      },
    }
  }

  public async updateStatus(id: string, status: 'ACTIVE' | 'DRAFT'): Promise<ShopifyMetaobject> {
    const { query, variables } = this.getUpdateStatusQuery(id, status)
    const response = await this.fetchGraphQL(query, variables)

    if (response.metaobjectUpdate.userErrors?.length > 0) {
      throw new Error(
        `Failed to update metaobject status: ${response.metaobjectUpdate.userErrors[0].message}`
      )
    }

    return response.metaobjectUpdate.metaobject
  }

  private getUpdateStatusQuery(id: string, status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED') {
    return {
      query: `mutation UpdateMetaobjectStatus($id: ID!, $metaobject: MetaobjectUpdateInput!) {
        metaobjectUpdate(id: $id, metaobject: $metaobject) {
          metaobject {
            id
            handle
            type
            capabilities {
              publishable {
                status
              }
            }
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
          capabilities: {
            publishable: {
              status,
            },
          },
        },
      },
    }
  }
}
