import Env from '@ioc:Adonis/Core/Env'
import axios, { AxiosInstance } from 'axios'

// Cost-aware rate limiter for Shopify API calls
class ShopifyCostRateLimiter {
  private availableCost: number
  private lastRefill: number
  private readonly maxCost: number
  private readonly restoreRate: number // cost points per second

  constructor(maxCost: number = 1000, restoreRate: number = 50) {
    this.maxCost = maxCost
    this.restoreRate = restoreRate
    this.availableCost = maxCost
    this.lastRefill = Date.now()
  }

  private refillCost(): void {
    const now = Date.now()
    const timePassed = (now - this.lastRefill) / 1000 // Convert to seconds
    const costToAdd = timePassed * this.restoreRate

    this.availableCost = Math.min(this.maxCost, this.availableCost + costToAdd)
    this.lastRefill = now
  }

  public async waitForCost(estimatedCost: number = 50): Promise<void> {
    this.refillCost()

    if (this.availableCost < estimatedCost) {
      const waitTime = ((estimatedCost - this.availableCost) / this.restoreRate) * 1000
      console.log(
        `Cost limiter: Waiting ${waitTime}ms for cost refill (need ${estimatedCost}, have ${this.availableCost.toFixed(1)})`
      )
      await new Promise((resolve) => setTimeout(resolve, waitTime))
      this.refillCost()
    }

    this.availableCost -= estimatedCost
    console.log(
      `Cost limiter: Cost consumed (${estimatedCost}). Remaining cost: ${this.availableCost.toFixed(1)}`
    )
  }
}

export default class Authentication {
  protected shopUrl = Env.get('SHOPIFY_SHOP_URL')
  protected apiVersion = Env.get('SHOPIFY_API_VERSION')
  protected accessToken = Env.get('SHOPIFY_ACCESS_TOKEN_SECRET')
  protected client: AxiosInstance
  private urlGraphQL = `${this.shopUrl}/${this.apiVersion}/graphql.json`
  private costLimiter = new ShopifyCostRateLimiter(1000, 50) // 1000 max cost, 50 restore rate

  constructor() {
    this.client = axios.create({
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': this.accessToken,
      },
      baseURL: `${this.shopUrl}/${this.apiVersion}`,
    })
  }

  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error as Error

        // Check if it's a throttling error
        if (error instanceof Error && error.message.includes('Throttled')) {
          if (attempt < maxRetries) {
            const delay = baseDelay * Math.pow(2, attempt - 1) // Exponential backoff
            console.log(
              `Shopify throttled, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`
            )
            await new Promise((resolve) => setTimeout(resolve, delay))
            continue
          }
        }

        // For other errors or if we've exhausted retries, throw immediately
        throw error
      }
    }

    throw lastError!
  }

  protected async fetchGraphQL(query: string, variables = {}, estimatedCost: number = 50) {
    return this.retryWithBackoff(async () => {
      try {
        // Wait for cost limiter
        await this.costLimiter.waitForCost(estimatedCost)

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
    })
  }
}
