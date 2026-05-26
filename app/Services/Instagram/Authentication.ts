import Env from '@ioc:Adonis/Core/Env'
import Token from 'App/Models/Token'
import Mail from '@ioc:Adonis/Addons/Mail'
import axios, { AxiosInstance } from 'axios'
import { DateTime } from 'luxon'

// Meta Graph API version. Stable enough that we pin it here; bump when needed.
const GRAPH_API_VERSION = 'v23.0'
const GRAPH_BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`

export default class Authentication {
  private tokenName = 'instagram'
  private clientId = Env.get('INSTAGRAM_APP_ID')
  private clientSecret = Env.get('INSTAGRAM_APP_SECRET')
  private cachedInstagramUserId: string | null = null
  protected client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: GRAPH_BASE_URL,
    })
  }

  /**
   * Returns the Instagram Business Account ID linked to the authorized
   * Facebook Page. Lazily fetched on first call and cached on the instance.
   * The IG user ID is what Meta calls "ig-user-id" in the Content Publishing
   * API — the target of POST /{ig-user-id}/media and /media_publish.
   */
  public async getInstagramUserId(): Promise<string> {
    if (this.cachedInstagramUserId) return this.cachedInstagramUserId

    const data = await this.request<{
      data: Array<{
        id: string
        name: string
        instagram_business_account?: { id: string }
      }>
    }>({
      method: 'GET',
      url: '/me/accounts',
      params: { fields: 'name,instagram_business_account' },
    })

    const pageWithIG = data.data?.find((p) => p.instagram_business_account?.id)
    if (!pageWithIG) {
      throw new Error(
        'No Facebook Page has a linked Instagram Business account. Check the IG <-> Page link in Meta Business Suite.'
      )
    }
    this.cachedInstagramUserId = pageWithIG.instagram_business_account!.id
    return this.cachedInstagramUserId
  }

  protected async request<T>(config: any): Promise<T> {
    await this.setupAuth()
    const response = await this.client.request(config)
    return response.data
  }

  private async setupAuth() {
    const accessToken = await this.getValidAccessToken()
    // Meta passes the token via query string (`access_token=...`) by convention.
    // Always inject as a query param so callers do not have to worry about it.
    this.client.defaults.params = { access_token: accessToken }
  }

  private async getValidAccessToken(): Promise<string> {
    const tokenModel = await Token.query().where('name', this.tokenName).first()

    if (!tokenModel || !tokenModel.accessToken || !tokenModel.refreshToken) {
      const errorMessage = 'Instagram token not found. Please perform authorization.'
      await this.sendEmail(errorMessage)
      throw new Error(errorMessage)
    }

    // The Page Access Token (stored in accessToken) is typically non-expiring as
    // long as the underlying long-lived user token is still valid. We refresh
    // pre-emptively when the user token (expiresAt) is within 5 days of expiring.
    if (tokenModel.expiresAt && tokenModel.expiresAt > DateTime.now().plus({ days: 5 })) {
      return tokenModel.accessToken
    }

    return await this.refreshAccessToken(tokenModel)
  }

  private async refreshAccessToken(tokenModel: Token): Promise<string> {
    try {
      // Step 1: extend the long-lived user token.
      const { data: exchangeData } = await axios.get(`${GRAPH_BASE_URL}/oauth/access_token`, {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          fb_exchange_token: tokenModel.refreshToken,
        },
      })
      const newUserToken: string = exchangeData.access_token
      const expiresIn: number = exchangeData.expires_in ?? 60 * 24 * 3600

      // Step 2: re-derive the Page Access Token from the new user token. Page
      // tokens derived from long-lived user tokens are themselves long-lived
      // (effectively non-expiring while the user remains a page admin).
      const newPageToken = await this.derivePageAccessToken(newUserToken)

      tokenModel.accessToken = newPageToken
      tokenModel.refreshToken = newUserToken
      tokenModel.expiresAt = DateTime.now().plus({ seconds: expiresIn })
      await tokenModel.save()

      return newPageToken
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

  /**
   * Given a long-lived user access token, find the Page that the IG Business
   * account is linked to and return its Page Access Token.
   *
   * The IG Content Publishing API is called against the IG user ID but
   * authenticated with the Page Access Token of the FB Page linked to that IG
   * account — not the user token directly.
   */
  public async derivePageAccessToken(userAccessToken: string): Promise<string> {
    const { data } = await axios.get(`${GRAPH_BASE_URL}/me/accounts`, {
      params: { access_token: userAccessToken },
    })
    const pages: Array<{ id: string; name: string; access_token: string }> = data.data ?? []
    if (pages.length === 0) {
      throw new Error(
        'No Facebook Pages returned by /me/accounts — the authorizing user is not an admin of any Page'
      )
    }
    // We expect exactly one Page (MyselfMonArt). If there are several, the
    // first is taken; the OAuth controller is responsible for surfacing the
    // ambiguity to the user when it happens.
    return pages[0].access_token
  }

  public async isRefreshTokenValid(): Promise<boolean> {
    const tokenModel = await Token.query()
      .where('name', this.tokenName)
      .whereNotNull('refreshToken')
      .first()
    return !!tokenModel
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
