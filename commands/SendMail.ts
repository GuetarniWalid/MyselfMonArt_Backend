import { BaseCommand } from '@adonisjs/core/build/standalone'
import Mail from '@ioc:Adonis/Addons/Mail'
import Env from '@ioc:Adonis/Core/Env'

export default class SendMail extends BaseCommand {
  public static commandName = 'send:mail'
  public static description = 'Send a a test email'

  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  public async run() {
    console.log('🚀 ~ Sending email...')
    console.log('🚀 ~ ', Env.get('MAIL_RECIPIENT'))

    await Mail.send((message) => {
      message
        .to(Env.get('MAIL_RECIPIENT'))
        .from(Env.get('MAIL_SENDER'))
        .subject('Problème dans le flux Shopify vers Merchant Center')
        .text(`This is a test email from AdonisJS`)
    })
  }
}
