import type { LanguageCode, RegionCode, TranslatableContent } from 'Types/Translation'
import type { Resource } from 'Types/Resource'
import Translator from './Translator'
import Pinterest from './Pinterest'
import ColorPatternDetector from './ColorPattern'
import ThemeDetector from './Theme'

export default class ChatGPT {
  public pinterest: Pinterest
  public colorPattern: ColorPatternDetector
  public theme: ThemeDetector

  constructor() {
    this.pinterest = new Pinterest()
    this.colorPattern = new ColorPatternDetector()
    this.theme = new ThemeDetector()
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
