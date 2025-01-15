import Token from 'App/Models/Token'
import Env from '@ioc:Adonis/Core/Env'
import Mail from '@ioc:Adonis/Addons/Mail'
import { google } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'

export default class Authentication {
  private tokenName = 'google_merchant_center'
  private oauth2Client: OAuth2Client

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      Env.get('GOOGLE_CLIENT_ID'),
      Env.get('GOOGLE_CLIENT_SECRET')
    )
  }

  public async getOauth2Client() {
    try {
      const tokenModel = await Token.findByOrFail('name', this.tokenName)

      if (!tokenModel.refreshToken) {
        throw new Error('No refresh token found')
      }

      this.oauth2Client.setCredentials({
        refresh_token: tokenModel.refreshToken,
      })

      return this.oauth2Client
    } catch (error) {
      await this.sendEmail(error)
      throw error
    }
  }

  public async isRefreshTokenValid() {
    try {
      const tokenModel = await Token.findByOrFail('name', this.tokenName)

      if (!tokenModel.refreshToken) {
        return false
      }

      this.oauth2Client.setCredentials({
        refresh_token: tokenModel.refreshToken,
      })

      await this.oauth2Client.getAccessToken()
      return true
    } catch (error) {
      if (error.response && error.response.data) {
        const errorData = error.response.data
        if (errorData.error === 'invalid_grant') {
          return false
        }
      }

      throw error
    }
  }

  private async sendEmail(error: Error) {
    await Mail.send((message) => {
      message
        .to(Env.get('MAIL_RECIPIENT'))
        .from(Env.get('MAIL_SENDER'))
        .subject('Problème durant le rafraîchissement du token Google')
        .text(`Une erreur est survenue lors du rafraîchissement du token Google : ${error.message}`)
    })
  }
}
