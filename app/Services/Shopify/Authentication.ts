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
    return this.retryOnThrottle(() => this.executeGraphQLRequest(query, variables))
  }

  private async executeGraphQLRequest(query: string, variables = {}) {
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

  private async retryOnThrottle<T>(
    fn: () => Promise<T>,
    maxRetries = 5,
    baseDelayMs = 1000
  ): Promise<T> {
    let attempt = 0

    while (attempt < maxRetries) {
      try {
        return await fn()
      } catch (error) {
        if (this.isThrottleError(error)) {
          attempt++
          if (attempt >= maxRetries) {
            throw new Error('Max retry attempts reached for throttled request')
          }

          const delayMs = baseDelayMs * Math.pow(2, attempt - 1) // Exponential backoff
          console.warn(
            `Throttled by Shopify API. Retrying in ${delayMs / 1000} seconds... (attempt ${attempt}/${maxRetries})`
          )
          await this.delay(delayMs)
        } else {
          throw error
        }
      }
    }

    throw new Error('Max retry attempts reached for throttled request')
  }

  private isThrottleError(error: any): boolean {
    if (!(error instanceof Error)) return false

    const errorMessage = error.message.toLowerCase()
    return (
      errorMessage.includes('throttled') ||
      errorMessage.includes('rate limit') ||
      errorMessage.includes('429')
    )
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
