import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import User from 'App/Models/User'

export default class SocialAuthsController {
  public async index({ ally, auth, response }: HttpContextContract) {
    const google = ally.use('google')
    console.log('🚀 ~ google:', google)

    if (google.accessDenied()) {
      return 'Access was denied'
    }

    if (google.stateMisMatch()) {
      return 'Request expired. Retry again'
    }

    if (google.hasError()) {
      return google.getError()
    }

    const googleUser = await google.user()
    const user = await User.firstOrCreate(
      {
        email: googleUser.email!,
      },
      {
        email: googleUser.email!,
      }
    )
    await auth.use('web').login(user)

    return response.redirect('/')
  }
}
