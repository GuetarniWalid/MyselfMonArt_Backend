import Env from '@ioc:Adonis/Core/Env'
import OpenAI from 'openai'

export default class Authentication {
  private apiKey = Env.get('OPENAI_API_KEY')
  protected openai: OpenAI

  constructor() {
    this.openai = new OpenAI({ apiKey: this.apiKey })
  }
}
