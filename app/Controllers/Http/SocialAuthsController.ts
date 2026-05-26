import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import User from 'App/Models/User'
import { OAuth2Client } from 'google-auth-library'
import Env from '@ioc:Adonis/Core/Env'
import Token from 'App/Models/Token'
import InstagramAuthentication from 'App/Services/Instagram/Authentication'
import axios from 'axios'
import { DateTime } from 'luxon'

const META_GRAPH_API_VERSION = 'v23.0'
const INSTAGRAM_SCOPES = [
  'instagram_basic',
  'instagram_content_publish',
  'instagram_shopping_tag_products',
  'pages_show_list',
  'pages_read_engagement',
]

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

  public async redirectToInstagram({ response }: HttpContextContract) {
    const redirectUri = `${Env.get('APP_URL')}/login/instagram/callback`
    const clientId = Env.get('INSTAGRAM_APP_ID')

    const url =
      `https://www.facebook.com/${META_GRAPH_API_VERSION}/dialog/oauth?` +
      `client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=${INSTAGRAM_SCOPES.join(',')}`

    return response.redirect(url)
  }

  public async handleInstagramCallback({ request, response }: HttpContextContract) {
    const { code } = request.qs()

    if (!code) {
      return response.status(400).send('No code returned from Instagram')
    }

    try {
      const redirectUri = `${Env.get('APP_URL')}/login/instagram/callback`
      const clientId = Env.get('INSTAGRAM_APP_ID')
      const clientSecret = Env.get('INSTAGRAM_APP_SECRET')
      const graphBaseUrl = `https://graph.facebook.com/${META_GRAPH_API_VERSION}`

      // Step 1: exchange the authorization code for a short-lived user token.
      const { data: shortLivedData } = await axios.get(`${graphBaseUrl}/oauth/access_token`, {
        params: {
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          code,
        },
      })
      const shortLivedToken: string = shortLivedData.access_token

      // Step 2: exchange it for a long-lived user token (~60 days).
      const { data: longLivedData } = await axios.get(`${graphBaseUrl}/oauth/access_token`, {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: clientId,
          client_secret: clientSecret,
          fb_exchange_token: shortLivedToken,
        },
      })
      const longLivedUserToken: string = longLivedData.access_token
      const expiresIn: number = longLivedData.expires_in ?? 60 * 24 * 3600

      // Step 3: derive the Page Access Token (used for IG Content Publishing).
      const instagramAuth = new InstagramAuthentication()
      const pageAccessToken = await instagramAuth.derivePageAccessToken(longLivedUserToken)

      const user = await User.firstOrFail()

      await Token.updateOrCreate(
        {
          name: 'instagram',
          userId: user.id,
        },
        {
          name: 'instagram',
          accessToken: pageAccessToken,
          refreshToken: longLivedUserToken,
          expiresAt: DateTime.now().plus({ seconds: expiresIn }),
          userId: user.id,
        }
      )

      return response.redirect('/')
    } catch (error) {
      console.error('Error fetching Instagram tokens:', error.response?.data || error.message)
      return response.status(500).send('Failed to fetch tokens from Instagram')
    }
  }
}
