import Anthropic from '@anthropic-ai/sdk'
import Env from '@ioc:Adonis/Core/Env'

export default class Authentication {
  private apiKey = Env.get('ANTHROPIC_API_KEY')
  protected anthropic: Anthropic

  constructor() {
    this.anthropic = new Anthropic({ apiKey: this.apiKey })
  }
}
