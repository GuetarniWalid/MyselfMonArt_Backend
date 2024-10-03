import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Google from '../../../services/Google'

export default class DashboardController {
  public async index({ view }: HttpContextContract) {
    const google = new Google()
    const isRefreshTokenValid = await google.authentication.isRefreshTokenValid()
    return view.render('welcome', { isRefreshTokenValid })
  }
}
