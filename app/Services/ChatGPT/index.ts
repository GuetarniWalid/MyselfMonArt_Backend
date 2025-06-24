import type { LanguageCode, TranslatableContent } from 'Types/Translation'
import type { Resource } from 'Types/Resource'
import Translator from './Translator'
import Pinterest from './Pinterest'

export default class ChatGPT {
  public pinterest: Pinterest

  constructor() {
    this.pinterest = new Pinterest()
  }

  public async translate(
    payload: TranslatableContent,
    resources: Resource,
    targetLanguage: LanguageCode
  ) {
    const translator = new Translator(payload, resources, targetLanguage)
    return translator.translate(payload)
  }
}
