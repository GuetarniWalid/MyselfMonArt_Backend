import Env from '@ioc:Adonis/Core/Env'
import axios, { AxiosInstance } from 'axios'

export default class Authentication {
  protected shopUrl = Env.get('SHOPIFY_SHOP_URL')
  protected apiVersion = Env.get('SHOPIFY_API_VERSION')
  protected accessToken = Env.get('SHOPIFY_ACCESS_TOKEN_SECRET')
  protected client: AxiosInstance

  constructor() {
    this.client = axios.create({
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': this.accessToken,
      },
      baseURL: `${this.shopUrl}/${this.apiVersion}`,
    })
  }
}
