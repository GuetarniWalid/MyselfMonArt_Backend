import Authentication from './Authentication'
import Env from '@ioc:Adonis/Core/Env'

/**
 * Sujets auxquels ce back-end sait s'abonner.
 *
 * ⛔ Ce sont des valeurs de l'énuméré `WebhookSubscriptionTopic`, relevées par introspection et
 * non recopiées de mémoire : Shopify en expose trois qui se ressemblent
 * (`CUSTOMERS_MARKETING_CONSENT_UPDATE`, `CUSTOMERS_WHATS_APP_...`, `CUSTOMERS_EMAIL_...`) et
 * un nom approché fait échouer la souscription, pas la compilation.
 *
 * ⚠️ Tous atterrissent sur la MÊME URL (`SHOPIFY_WEBHOOK_URL`, cf. plus bas). En ajouter un
 * suppose donc de lui ouvrir une branche dans `WebhooksController.handle` : un sujet souscrit
 * sans oreille en face échoue, et Shopify SUPPRIME définitivement un abonnement après 8 échecs
 * consécutifs en 4 heures.
 */
export type WebhookTopic =
  | 'PRODUCTS_UPDATE'
  | 'PRODUCTS_CREATE'
  | 'PRODUCTS_DELETE'
  | 'ORDERS_PAID'
  | 'CUSTOMERS_EMAIL_MARKETING_CONSENT_UPDATE'

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

  public async createWebhookSubscription(topic: WebhookTopic, metafieldNamespaces: string[] = []) {
    const { query, variables } = this.createWebhookSubscriptionQuery(topic, metafieldNamespaces)
    const response = await this.fetchGraphQL(query, variables)
    const userErrors = response.webhookSubscriptionCreate?.userErrors || []
    if (userErrors.length > 0) {
      throw new Error(
        `webhookSubscriptionCreate ${topic}: ${userErrors.map((e: any) => e.message).join(', ')}`
      )
    }
    return response.webhookSubscriptionCreate.webhookSubscription
  }

  private createWebhookSubscriptionQuery(topic: WebhookTopic, metafieldNamespaces: string[]) {
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
