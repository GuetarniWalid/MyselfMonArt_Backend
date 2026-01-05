import type { LanguageCode, RegionCode, TranslatableContent } from 'Types/Translation'
import type { Resource } from 'Types/Resource'
import Translator from './Translator'
import Pinterest from './Pinterest'
import ColorPatternDetector from './ColorPattern'

export default class ChatGPT {
  public pinterest: Pinterest
  public colorPattern: ColorPatternDetector

  constructor() {
    this.pinterest = new Pinterest()
    this.colorPattern = new ColorPatternDetector()
  }

  public async translate(
    payload: TranslatableContent,
    resources: Resource,
    targetLanguage: LanguageCode,
    targetRegion?: RegionCode
  ) {
    const translator = new Translator(payload, resources, targetLanguage, targetRegion)
    return translator.translate(payload)
  }
}
