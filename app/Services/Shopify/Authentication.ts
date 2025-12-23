import Env from '@ioc:Adonis/Core/Env'
import axios, { AxiosInstance } from 'axios'

// Cost-aware rate limiter for Shopify API calls (Singleton)
class ShopifyCostRateLimiter {
  private static instance: ShopifyCostRateLimiter
  private availableCost: number
  private lastRefill: number
  private maxCost: number // Made mutable to adjust from Shopify responses
  private readonly restoreRate: number // cost points per second
  private readonly safetyBuffer: number = 100 // Reserve 100 points as safety margin
  private pendingRequests: number = 0 // Track concurrent requests

  private constructor(maxCost: number = 2000, restoreRate: number = 100) {
    // Standard Shopify: estimated 2000 bucket, 100 points/second
    // Advanced: estimated 4000 bucket, 200 points/second
    // Plus: estimated 10000 bucket, 1000 points/second
    // Will auto-adjust maxCost from Shopify's throttleStatus.maximumAvailable
    this.maxCost = maxCost
    this.restoreRate = restoreRate
    this.availableCost = maxCost
    this.lastRefill = Date.now()
    console.log(`[RateLimiter] Initialized with ${maxCost} max cost, ${restoreRate} points/second`)
  }

  public static getInstance(): ShopifyCostRateLimiter {
    if (!ShopifyCostRateLimiter.instance) {
      ShopifyCostRateLimiter.instance = new ShopifyCostRateLimiter()
    }
    return ShopifyCostRateLimiter.instance
  }

  private refillCost(): void {
    const now = Date.now()
    const timePassed = (now - this.lastRefill) / 1000 // Convert to seconds

    // Protect against clock going backwards (NTP sync, DST, etc.)
    if (timePassed < 0) {
      console.warn(
        `[RateLimiter] Clock went backwards by ${Math.abs(timePassed)}s, resetting refill timer`
      )
      this.lastRefill = now
      return
    }

    // Avoid excessive refill if system was suspended
    const maxTimePassed = 120 // Cap at 2 minutes to avoid huge refills after sleep
    const effectiveTimePassed = Math.min(timePassed, maxTimePassed)
    const costToAdd = effectiveTimePassed * this.restoreRate

    this.availableCost = Math.min(this.maxCost, this.availableCost + costToAdd)
    this.lastRefill = now
  }

  public async waitForCost(estimatedCost: number = 50): Promise<void> {
    // Validate input
    if (!Number.isFinite(estimatedCost) || estimatedCost < 0) {
      throw new Error(`[RateLimiter] Invalid estimatedCost: ${estimatedCost}`)
    }

    // Warn if request exceeds bucket capacity
    if (estimatedCost > this.maxCost) {
      console.error(
        `[RateLimiter] WARNING: Estimated cost (${estimatedCost}) exceeds max bucket (${this.maxCost})! This request may be throttled by Shopify.`
      )
    }

    this.pendingRequests++

    // Note: A rare race condition exists where multiple concurrent requests
    // wake from await simultaneously and over-deduct. This is mitigated by:
    // 1. Safety buffer (100 points) provides cushion
    // 2. Actual cost tracking corrects errors via updateActualCost()
    // 3. Negative clamp in updateActualCost() prevents crashes
    // 4. Node.js single-threaded execution minimizes race window
    // A full mutex would eliminate this but adds complexity/dependencies.
    try {
      this.refillCost()

      // Add safety buffer
      const requiredCost = estimatedCost + this.safetyBuffer

      if (this.availableCost < requiredCost) {
        const waitTime = ((requiredCost - this.availableCost) / this.restoreRate) * 1000

        // Warn about long waits or high concurrency
        if (waitTime > 30000) {
          console.warn(
            `[RateLimiter] Long wait: ${Math.ceil(waitTime / 1000)}s for ${estimatedCost} points (${this.pendingRequests} pending requests)`
          )
        }

        if (this.pendingRequests > 5) {
          console.warn(
            `[RateLimiter] High concurrency: ${this.pendingRequests} pending requests. Consider queuing webhooks.`
          )
        }

        console.log(
          `[RateLimiter] Waiting ${Math.ceil(waitTime)}ms for cost refill (need ${estimatedCost}, have ${this.availableCost.toFixed(1)})`
        )
        await new Promise((resolve) => setTimeout(resolve, waitTime))
        this.refillCost()
      }

      this.availableCost -= estimatedCost
      console.log(
        `[RateLimiter] Reserved ${estimatedCost} points. Available: ${this.availableCost.toFixed(1)}/${this.maxCost} (${this.pendingRequests} pending)`
      )
    } finally {
      this.pendingRequests--
    }
  }

  public updateActualCost(actualCost: number, estimatedCost: number): void {
    // Validate inputs
    if (!Number.isFinite(actualCost) || actualCost < 0) {
      console.error(`[RateLimiter] Invalid actualCost: ${actualCost}, ignoring update`)
      return
    }

    const difference = actualCost - estimatedCost

    // Adjust available cost based on reality
    this.availableCost -= difference

    // Clamp to prevent negative (in case we severely underestimated)
    if (this.availableCost < 0) {
      console.error(
        `[RateLimiter] CRITICAL: Available cost went negative (${this.availableCost.toFixed(1)})! We severely underestimated. Setting to 0.`
      )
      this.availableCost = 0
      this.lastRefill = Date.now() // Reset refill timer
    }

    // Log if our estimate was way off
    if (Math.abs(difference) > 50) {
      console.warn(
        `[RateLimiter] Cost estimate off by ${difference} (estimated: ${estimatedCost}, actual: ${actualCost})`
      )
    }

    console.log(
      `[RateLimiter] Actual cost: ${actualCost}, Available: ${this.availableCost.toFixed(1)}/${this.maxCost}`
    )
  }

  // Update bucket size dynamically from Shopify responses
  public updateMaxCost(newMaxCost: number): void {
    if (newMaxCost !== this.maxCost && Number.isFinite(newMaxCost) && newMaxCost > 0) {
      console.log(`[RateLimiter] Adjusting max cost: ${this.maxCost} → ${newMaxCost}`)
      this.maxCost = newMaxCost
      // Clamp current available to new max
      this.availableCost = Math.min(this.availableCost, this.maxCost)
    }
  }

  public get currentAvailable(): number {
    this.refillCost()
    return this.availableCost
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
  private costLimiter = ShopifyCostRateLimiter.getInstance() // Shared singleton instance
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

          // CRITICAL: Extract actual cost from Shopify response
          const actualCost = responseBody.extensions?.cost?.actualQueryCost
          if (actualCost !== undefined) {
            this.costLimiter.updateActualCost(actualCost, estimatedCost)
          } else {
            console.warn('[Authentication] No cost data in response - using estimate')
          }

          // Check throttle status from Shopify
          const throttleStatus = responseBody.extensions?.cost?.throttleStatus
          if (throttleStatus && typeof throttleStatus.currentlyAvailable === 'number') {
            console.log(
              `[Authentication] Shopify bucket: ${throttleStatus.currentlyAvailable}/${throttleStatus.maximumAvailable || 'unknown'} (restore: ${throttleStatus.restoreRate || 'unknown'}/s)`
            )

            // Dynamically adjust our bucket size to match Shopify's actual bucket
            if (typeof throttleStatus.maximumAvailable === 'number') {
              this.costLimiter.updateMaxCost(throttleStatus.maximumAvailable)
            }

            // Warn if Shopify's bucket is getting low
            if (throttleStatus.currentlyAvailable < 500) {
              console.warn(
                `[Authentication] WARNING: Shopify bucket running low (${throttleStatus.currentlyAvailable} available)`
              )
            }
          }

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
