import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import User from 'App/Models/User'
import { OAuth2Client } from 'google-auth-library'
import Env from '@ioc:Adonis/Core/Env'
import Token from 'App/Models/Token'
import axios from 'axios'
import { DateTime } from 'luxon'

export default class SocialAuthsController {
  public async index({ ally, auth, response }: HttpContextContract) {
    const google = ally.use('google')
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

  public async redirectToGoogle({ response }: HttpContextContract) {
    const scopes = ['https://www.googleapis.com/auth/content']

    const oauth2Client = new OAuth2Client(
      Env.get('GOOGLE_CLIENT_ID'),
      Env.get('GOOGLE_CLIENT_SECRET'),
      `${Env.get('APP_URL')}/login/merchant-center/callback`
    )

    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: scopes,
    })

    return response.redirect(url)
  }

  public async handleGoogleCallback({ request, response }: HttpContextContract) {
    const { code } = request.qs()

    if (!code) {
      return response.status(400).send('No code returned from Google')
    }

    try {
      const oauth2Client = new OAuth2Client(
        Env.get('GOOGLE_CLIENT_ID'),
        Env.get('GOOGLE_CLIENT_SECRET'),
        `${Env.get('APP_URL')}/login/merchant-center/callback`
      )
      const { tokens } = await oauth2Client.getToken(code)

      const users = await User.all()
      users.forEach(async (user) => {
        const tokenModel = await Token.firstOrCreate(
          {
            userId: user.id,
            name: 'google_merchant_center',
          },
          {
            userId: user.id,
            name: 'google_merchant_center',
            refreshToken: tokens.refresh_token,
          }
        )
        tokenModel.refreshToken = tokens.refresh_token as string
        await tokenModel.save()
      })

      return response.redirect('/')
    } catch (error) {
      console.error('Error fetching Google tokens:', error)
      return response.status(500).send('Failed to fetch tokens from Google')
    }
  }

  public async redirectToPinterest({ response }: HttpContextContract) {
    const scopes = ['boards:read', 'boards:write', 'pins:read', 'pins:write', 'user_accounts:read']
    const redirectUri = `${Env.get('APP_URL')}/login/pinterest/callback`
    const clientId = Env.get('PINTEREST_CLIENT_ID')

    const url = `https://www.pinterest.com/oauth/?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scopes.join(',')}&response_mode=query`

    return response.redirect(url)
  }

  public async handlePinterestCallback({ request, response }: HttpContextContract) {
    const { code } = request.qs()

    if (!code) {
      return response.status(400).send('No code returned from Pinterest')
    }

    try {
      const redirectUri = `${Env.get('APP_URL')}/login/pinterest/callback`
      const clientId = Env.get('PINTEREST_CLIENT_ID')
      const clientSecret = Env.get('PINTEREST_CLIENT_SECRET')

      const params = new URLSearchParams()
      params.append('grant_type', 'authorization_code')
      params.append('code', code as string)
      params.append('redirect_uri', redirectUri)

      const authHeader = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`

      const { data } = await axios.post('https://api.pinterest.com/v5/oauth/token', params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': authHeader,
        },
      })

      const { access_token: accessToken, refresh_token: refreshToken, expires_in: expiresIn } = data

      const user = await User.firstOrFail()

      await Token.updateOrCreate(
        {
          name: 'pinterest',
          userId: user.id,
        },
        {
          name: 'pinterest',
          accessToken: accessToken,
          refreshToken: refreshToken,
          expiresAt: DateTime.now().plus({ seconds: expiresIn }),
          userId: user.id,
        }
      )

      return response.redirect('/')
    } catch (error) {
      console.error('Error fetching Pinterest tokens:', error.response?.data || error.message)
      return response.status(500).send('Failed to fetch tokens from Pinterest')
    }
  }
}
