import type { LanguageCode, TranslatableContent } from 'Types/Translation'
import Translator from './Translator'

export default class ChatGPT {
  public async translate(
    payload: TranslatableContent,
    resources: 'product' | 'collection' | 'article',
    targetLanguage: LanguageCode
  ) {
    const translator = new Translator(payload, resources, targetLanguage)
    return translator.translate(payload)
  }
}
