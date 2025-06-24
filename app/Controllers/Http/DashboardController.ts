import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Google from 'App/Services/Google'
import PinterestAuthentication from 'App/Services/Pinterest/Authentication'

export default class DashboardController {
  public async index({ view }: HttpContextContract) {
    const google = new Google()
    const isGoogleRefreshTokenValid = await google.authentication.isRefreshTokenValid()
    const pinterestAuthentication = new PinterestAuthentication()
    const isPinterestRefreshTokenValid = await pinterestAuthentication.isRefreshTokenValid()
    return view.render('welcome', {
      isGoogleRefreshTokenValid: isGoogleRefreshTokenValid,
      isPinterestRefreshTokenValid: isPinterestRefreshTokenValid,
    })
  }
}
