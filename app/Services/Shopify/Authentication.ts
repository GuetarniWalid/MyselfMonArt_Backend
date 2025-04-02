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
    const response = await fetch(this.urlGraphQL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': this.accessToken,
      },
      body: JSON.stringify({ query, variables }),
    })

    const responseBody = await response.json()

    if (responseBody.errors) {
      console.error('Shopify GraphQL errors:', responseBody.errors)
      throw new Error('Failed to fetch Shopify GraphQL API')
    }

    return responseBody.data
  }
}
