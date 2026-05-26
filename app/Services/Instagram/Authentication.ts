import Env from '@ioc:Adonis/Core/Env'
import Token from 'App/Models/Token'
import Mail from '@ioc:Adonis/Addons/Mail'
import axios, { AxiosInstance } from 'axios'
import { DateTime } from 'luxon'

// Instagram Graph API base URL (Instagram Login flow).
// Unlike Facebook Login for Business — which routed everything through
// graph.facebook.com and required a Page Access Token derivation — Instagram
// Login lets us talk directly to graph.instagram.com with the user's IG
// access token. Simpler, less hops, and the only flow that still exposes
// `instagram_business_content_publish` as of 2026.
const GRAPH_API_VERSION = 'v23.0'
const GRAPH_BASE_URL = `https://graph.instagram.com/${GRAPH_API_VERSION}`

export default class Authentication {
  private tokenName = 'instagram'
  private clientSecret = Env.get('INSTAGRAM_APP_SECRET')
  private cachedInstagramUserId: string | null = null
  protected client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: GRAPH_BASE_URL,
    })
  }

  /**
   * Returns the Instagram Business Account ID for the authorized account.
   * Lazily fetched via GET /me and cached on the instance.
   */
  public async getInstagramUserId(): Promise<string> {
    if (this.cachedInstagramUserId) return this.cachedInstagramUserId

    const data = await this.request<{ id: string; username?: string }>({
      method: 'GET',
      url: '/me',
      params: { fields: 'id,username' },
    })

    if (!data.id) {
      throw new Error('GET /me did not return an Instagram user id')
    }
    this.cachedInstagramUserId = data.id
    return this.cachedInstagramUserId
  }

  protected async request<T>(config: any): Promise<T> {
    await this.setupAuth()
    const response = await this.client.request(config)
    return response.data
  }

  private async setupAuth() {
    const accessToken = await this.getValidAccessToken()
    this.client.defaults.params = { access_token: accessToken }
  }

  private async getValidAccessToken(): Promise<string> {
    const tokenModel = await Token.query().where('name', this.tokenName).first()

    if (!tokenModel || !tokenModel.accessToken) {
      const errorMessage = 'Instagram token not found. Please perform authorization.'
      await this.sendEmail(errorMessage)
      throw new Error(errorMessage)
    }

    // Refresh pre-emptively when the token is within 5 days of expiring.
    if (tokenModel.expiresAt && tokenModel.expiresAt > DateTime.now().plus({ days: 5 })) {
      return tokenModel.accessToken
    }

    return await this.refreshAccessToken(tokenModel)
  }

  private async refreshAccessToken(tokenModel: Token): Promise<string> {
    try {
      // Instagram refresh: hit graph.instagram.com/refresh_access_token with
      // the current long-lived token. This extends the token's lifetime for
      // another ~60 days but does NOT issue a different token value —
      // accessToken and refreshToken stay synced.
      const { data } = await axios.get('https://graph.instagram.com/refresh_access_token', {
        params: {
          grant_type: 'ig_refresh_token',
          access_token: tokenModel.refreshToken ?? tokenModel.accessToken,
        },
      })
      const newToken: string = data.access_token
      const expiresIn: number = data.expires_in ?? 60 * 24 * 3600

      tokenModel.accessToken = newToken
      tokenModel.refreshToken = newToken
      tokenModel.expiresAt = DateTime.now().plus({ seconds: expiresIn })
      await tokenModel.save()

      return newToken
    } catch (error) {
      console.error('Instagram token refresh failed:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      })
      await this.sendEmail(error)
      throw error
    }
  }

  public async isRefreshTokenValid(): Promise<boolean> {
    const tokenModel = await Token.query()
      .where('name', this.tokenName)
      .whereNotNull('refreshToken')
      .first()
    return !!tokenModel
  }

  // Kept for compatibility/silence the type checker if anything else still
  // references the secret; the controller reads it directly from env.
  protected get _clientSecret(): string {
    return this.clientSecret
  }

  private async sendEmail(error: any) {
    const subject =
      error instanceof Error ? 'Instagram Authentication Error' : 'Instagram Token Refresh Error'
    const text =
      error instanceof Error
        ? error.message
        : `An error occurred during Instagram token refresh: ${error.message}`

    await Mail.send((message) => {
      message.to(Env.get('MAIL_RECIPIENT')).from(Env.get('MAIL_SENDER')).subject(subject).text(text)
    })
  }
}
