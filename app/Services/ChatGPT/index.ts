import type { LanguageCode, TranslatableContent } from 'Types/Translation'
import type { Resource } from 'Types/Resource'
import Translator from './Translator'

export default class ChatGPT {
  public async translate(
    payload: TranslatableContent,
    resources: Resource,
    targetLanguage: LanguageCode
  ) {
    const translator = new Translator(payload, resources, targetLanguage)
    return translator.translate(payload)
  }
}
