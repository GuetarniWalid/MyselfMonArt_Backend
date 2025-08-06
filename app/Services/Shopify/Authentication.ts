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

// Circuit breaker to prevent cascading failures
class CircuitBreaker {
  private failureCount = 0
  private lastFailureTime = 0
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED'
  private readonly failureThreshold = 5
  private readonly recoveryTimeout = 60000 // 1 minute

  public async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
        this.state = 'HALF_OPEN'
        console.log('Circuit breaker: Attempting to close (HALF_OPEN)')
      } else {
        throw new Error('Circuit breaker is OPEN - Shopify API is experiencing issues')
      }
    }

    try {
      const result = await operation()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  private onSuccess(): void {
    this.failureCount = 0
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED'
      console.log('Circuit breaker: Closed (recovered)')
    }
  }

  private onFailure(): void {
    this.failureCount++
    this.lastFailureTime = Date.now()

    if (
      this.state === 'HALF_OPEN' ||
      (this.state === 'CLOSED' && this.failureCount >= this.failureThreshold)
    ) {
      this.state = 'OPEN'
      console.log(`Circuit breaker: Opened after ${this.failureCount} failures`)
    }
  }

  public getState(): string {
    return this.state
  }
}

export default class Authentication {
  protected shopUrl = Env.get('SHOPIFY_SHOP_URL')
  protected apiVersion = Env.get('SHOPIFY_API_VERSION')
  protected accessToken = Env.get('SHOPIFY_ACCESS_TOKEN_SECRET')
  protected client: AxiosInstance
  private urlGraphQL = `${this.shopUrl}/${this.apiVersion}/graphql.json`
  private costLimiter = new ShopifyCostRateLimiter(1000, 50) // 1000 max cost, 50 restore rate
  private circuitBreaker = new CircuitBreaker()

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

        // Check if it's a retryable error
        const isRetryable = this.isRetryableError(error)

        if (isRetryable && attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt - 1) // Exponential backoff
          console.log(
            `Shopify error (retryable), retrying in ${delay}ms (attempt ${attempt}/${maxRetries}): ${error.message}`
          )
          await new Promise((resolve) => setTimeout(resolve, delay))
          continue
        }

        // For non-retryable errors or if we've exhausted retries, throw immediately
        throw error
      }
    }

    throw lastError!
  }

  private isRetryableError(error: any): boolean {
    if (!error || !error.message) return false

    const message = error.message.toLowerCase()

    // Retryable errors
    const retryablePatterns = [
      'throttled',
      'rate limit',
      'internal error',
      'internal server error',
      'something went wrong on our end',
      'temporary',
      'timeout',
      'network error',
      'connection error',
    ]

    return retryablePatterns.some((pattern) => message.includes(pattern))
  }

  protected async fetchGraphQL(query: string, variables = {}, estimatedCost: number = 50) {
    return this.circuitBreaker.execute(async () => {
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
    })
  }
}
