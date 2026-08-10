import Env from '@ioc:Adonis/Core/Env'
import Token from 'App/Models/Token'
import TokenAlert from 'App/Services/Social/TokenAlert'
import axios, { AxiosInstance } from 'axios'
import { DateTime } from 'luxon'

export default class Authentication {
  private tokenName = 'pinterest'
  private clientId = Env.get('PINTEREST_CLIENT_ID')
  private clientSecret = Env.get('PINTEREST_CLIENT_SECRET')
  protected client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: 'https://api.pinterest.com/v5',
    })
  }

  protected async request<T>(config: any): Promise<T> {
    await this.setupAuth()
    const response = await this.client.request(config)
    return response.data
  }

  private async setupAuth() {
    const accessToken = await this.getValidAccessToken()
    this.client.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`
  }

  private async getValidAccessToken(): Promise<string> {
    const tokenModel = await Token.query().where('name', this.tokenName).first()

    if (!tokenModel || !tokenModel.accessToken || !tokenModel.refreshToken) {
      const errorMessage = 'Pinterest token not found. Please perform authorization.'
      await this.sendEmail(errorMessage)
      throw new Error(errorMessage)
    }

    if (tokenModel.expiresAt && tokenModel.expiresAt > DateTime.now().plus({ minutes: 5 })) {
      return tokenModel.accessToken
    }

    return await this.refreshAccessToken(tokenModel)
  }

  private async refreshAccessToken(tokenModel: Token): Promise<string> {
    try {
      const params = new URLSearchParams()
      params.append('grant_type', 'refresh_token')
      params.append('refresh_token', tokenModel.refreshToken as string)

      const response = await axios.post('https://api.pinterest.com/v5/oauth/token', params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString(
            'base64'
          )}`,
        },
      })

      const {
        access_token: accessToken,
        expires_in: expiresIn,
        refresh_token: rotatedRefreshToken,
      } = response.data

      tokenModel.accessToken = accessToken
      tokenModel.expiresAt = DateTime.now().plus({ seconds: expiresIn })
      // Pinterest peut renvoyer un refresh token renouvelé. Ne pas le
      // réenregistrer condamnait l'intégration : on gardait indéfiniment celui
      // délivré à la toute première autorisation, jusqu'à son expiration (un an)
      // — c'est ainsi que la publication Pinterest s'est arrêtée le 2026-07-20,
      // sans possibilité de rattrapage automatique.
      if (rotatedRefreshToken) {
        tokenModel.refreshToken = rotatedRefreshToken
      }
      await tokenModel.save()

      return accessToken
    } catch (error) {
      console.error('Token refresh failed:', {
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

  /**
   * Alerte l'exploitant. Ne lance JAMAIS : auparavant l'échec SMTP
   * (ports bloqués sur le droplet) remplaçait l'erreur d'origine dans les
   * logs, et le vrai motif — jeton expiré — restait invisible.
   */
  private async sendEmail(error: any) {
    await TokenAlert.notify('pinterest', error)
  }
}
