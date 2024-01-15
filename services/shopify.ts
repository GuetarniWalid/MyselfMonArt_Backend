import axios, { AxiosInstance } from 'axios'
import Env from '@ioc:Adonis/Core/Env'

export default class Shopify {
  private shopUrl = Env.get('SHOPIFY_SHOP_URL')
  private apiVersion = Env.get('SHOPIFY_API_VERSION')
  private accessToken = Env.get('SHOPIFY_ACCESS_TOKEN_SECRET')
  private endpoints = {
    product: 'products.json',
    order: 'products.json',
  }
  private client: AxiosInstance

  constructor(endpoint: 'product' | 'order') {
    this.client = axios.create({
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': this.accessToken,
      },
      baseURL: `${this.shopUrl}/${this.apiVersion}/${this.endpoints[endpoint]}`,
    })
  }

  public async createProduct(product: Product) {
    const response = this.client.request({ method: 'POST', data: { product } })
    return response
  }
}
