import { BaseCommand } from '@adonisjs/core/build/standalone'
import Env from '@ioc:Adonis/Core/Env'
import { google } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'
import Token from 'App/Models/Token'

export default class DeleteMerchantCenterProducts extends BaseCommand {
  public static commandName = 'delete:merchant_center_products'
  public static description = 'Delete all products from Google Merchant Center'

  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  public async run() {
    const oauth2Client = await this.getOauth2Client()
    await this.refreshToken(oauth2Client)
    const productIds = await this.getProductIds(oauth2Client)
    await this.deleteProducts(oauth2Client, productIds)
  }

  private async getOauth2Client() {
    const refreshToken = await this.getOldRefreshToken()
    const oauth2Client = new google.auth.OAuth2(
      Env.get('GOOGLE_CLIENT_ID'),
      Env.get('GOOGLE_CLIENT_SECRET')
    )

    oauth2Client.setCredentials({ refresh_token: refreshToken })
    return oauth2Client
  }

  private async refreshToken(oauth2Client: OAuth2Client) {
    const { token } = await oauth2Client.getAccessToken()
    oauth2Client.setCredentials({
      access_token: token,
    })

    const tokenModels = await Token.query().where('name', 'google_merchant_center')
    tokenModels.forEach(async (tokenModel) => {
      tokenModel.refreshToken = token ?? null
      await tokenModel.save()
    })
  }

  private async getOldRefreshToken() {
    const token = await Token.findByOrFail('name', 'google_merchant_center')
    return token.refreshToken as string
  }

  private async getProductIds(oauth2Client) {
    const content = google.content('v2.1')

    const response = await content.products.list({
      auth: oauth2Client,
      merchantId: Env.get('ID_MERCHANT_CENTER'),
    })

    const products = response.data.resources ?? []
    const productIds = products.map((product) => product.id)

    console.log('🚀 ~ Produits récupérés avec succès:', products)
    return productIds
  }

  private async deleteProducts(oauth2Client, productIds) {
    const content = google.content('v2.1')

    try {
      const promises = productIds.map((productId) => {
        return content.products.delete({
          auth: oauth2Client,
          merchantId: Env.get('ID_MERCHANT_CENTER'),
          productId: productId,
        })
      })

      await Promise.all(promises)
      console.log('🚀 ~ Produits supprimés avec succès')
    } catch (error) {
      console.error('🚀 ~ Erreur lors de la suppression des produits:', error)
    }
  }
}
