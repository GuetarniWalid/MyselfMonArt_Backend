import Authentication from './Authentication'
import Env from '@ioc:Adonis/Core/Env'
export default class Webhook extends Authentication {
  public async getSubscriptions() {
    const { query, variables } = this.getSubscriptionsQuery()
    const response = await this.fetchGraphQL(query, variables)
    return response.webhookSubscriptions.edges
  }

  private getSubscriptionsQuery() {
    return {
      query: `
        query WebhookSubscriptionList {
            webhookSubscriptions(first: 250) {
                edges {
                    node {
                        id
                        topic
                        endpoint {
                            ... on WebhookHttpEndpoint {
                                callbackUrl
                            }
                            ... on WebhookEventBridgeEndpoint {
                                arn
                            }
                            ... on WebhookPubSubEndpoint {
                                pubSubProject
                                pubSubTopic
                            }
                        }
                        createdAt
                        updatedAt
                        apiVersion {
                            handle
                        }
                        format
                        includeFields
                        metafieldNamespaces
                    }
                }
            }
        }
    `,
      variables: {},
    }
  }

  public async updateSubscription(subscriptionId: string, callbackUrl: string) {
    const { query, variables } = this.updateSubscriptionQuery(subscriptionId, callbackUrl)
    const response = await this.fetchGraphQL(query, variables)
    return {
      userErrors: response.webhookSubscriptionUpdate.userErrors,
      webhookSubscription: response.webhookSubscriptionUpdate.webhookSubscription,
    }
  }

  private updateSubscriptionQuery(subscriptionId: string, callbackUrl: string) {
    return {
      query: `
        mutation webhookSubscriptionUpdate($id: ID!, $webhookSubscription: WebhookSubscriptionInput!) {
      webhookSubscriptionUpdate(id: $id, webhookSubscription: $webhookSubscription) {
        userErrors {
          field
          message
        }
        webhookSubscription {
          id
          topic
          endpoint {
            ... on WebhookHttpEndpoint {
              callbackUrl
            }
          }
        }
      }
    }
      `,
      variables: {
        id: subscriptionId,
        webhookSubscription: {
          callbackUrl: callbackUrl,
        },
      },
    }
  }

  public async createWebhookSubscription(
    topic: 'PRODUCTS_UPDATE' | 'PRODUCTS_CREATE' | 'PRODUCTS_DELETE',
    metafieldNamespaces: string[] = []
  ) {
    const { query, variables } = this.createWebhookSubscriptionQuery(topic, metafieldNamespaces)
    const response = await this.fetchGraphQL(query, variables)
    return response.webhookSubscriptionCreate.webhookSubscription
  }

  private createWebhookSubscriptionQuery(
    topic: 'PRODUCTS_UPDATE' | 'PRODUCTS_CREATE' | 'PRODUCTS_DELETE',
    metafieldNamespaces: string[]
  ) {
    return {
      query: `
        mutation WebhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
            webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
                webhookSubscription {
                    id
                    topic
                    apiVersion {
                        handle
                    }
                    format
                    createdAt
                }
                userErrors {
                    field
                    message
                }
            }
        }
      `,
      variables: {
        topic: topic,
        webhookSubscription: {
          callbackUrl: Env.get('SHOPIFY_WEBHOOK_URL'),
          format: 'JSON',
          metafieldNamespaces: metafieldNamespaces,
        },
      },
    }
  }

  public async deleteWebhookSubscription(subscriptionId: string) {
    const { query, variables } = this.deleteWebhookSubscriptionQuery(subscriptionId)
    const response = await this.fetchGraphQL(query, variables)
    return response.webhookSubscriptionDelete
  }

  private deleteWebhookSubscriptionQuery(subscriptionId: string) {
    return {
      query: `
        mutation webhookSubscriptionDelete($id: ID!) {
            webhookSubscriptionDelete(id: $id) {
                deletedWebhookSubscriptionId
                userErrors {
                    field
                    message
                }
            }
        }
      `,
      variables: {
        id: subscriptionId,
      },
    }
  }
}
