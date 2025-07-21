import Env from '@ioc:Adonis/Core/Env'
import axios, { AxiosInstance } from 'axios'

export default class Authentication {
  protected shopUrl = Env.get('SHOPIFY_SHOP_URL')
  protected apiVersion = Env.get('SHOPIFY_API_VERSION')
  protected accessToken = Env.get('SHOPIFY_ACCESS_TOKEN_SECRET')
  protected client: AxiosInstance
  private urlGraphQL = `${this.shopUrl}/${this.apiVersion}/graphql.json`

  constructor() {
    this.client = axios.create({
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': this.accessToken,
      },
      baseURL: `${this.shopUrl}/${this.apiVersion}`,
    })
  }

  protected async fetchGraphQL(query: string, variables = {}) {
    try {
      // Validate required environment variables
      if (!this.shopUrl || !this.apiVersion || !this.accessToken) {
        throw new Error(
          `Missing Shopify configuration: shopUrl=${!!this.shopUrl}, apiVersion=${!!this.apiVersion}, accessToken=${!!this.accessToken}`
        )
      }

      console.log(`Making GraphQL request to: ${this.urlGraphQL}`)

      const response = await fetch(this.urlGraphQL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': this.accessToken,
        },
        body: JSON.stringify({ query, variables }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }

      const responseBody = await response.json()

      if (responseBody.errors) {
        console.error('Shopify GraphQL errors:', JSON.stringify(responseBody.errors, null, 2))
        const errorMessages = responseBody.errors.map((error: any) => error.message).join(', ')
        throw new Error(`Shopify GraphQL API errors: ${errorMessages}`)
      }

      return responseBody.data
    } catch (error) {
      if (error instanceof Error) {
        console.error('GraphQL request failed:', error.message)
        throw error
      }
      throw new Error(`Unexpected error in GraphQL request: ${error}`)
    }
  }
}
