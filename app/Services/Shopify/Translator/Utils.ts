import type { LanguageCode, TranslationInput } from 'Types/Translation'
import { createHash } from 'crypto'

export default class Utils {
  public createTranslationEntry(
    data: {
      key: string
      isoCode: LanguageCode
      newValue: string
      oldValue: string
    },
    translationsInputs: TranslationInput[]
  ): void {
    const translationEntry = {
      key: data.key,
      locale: data.isoCode,
      translatableContentDigest: this.generateContentDigest(data.oldValue),
      value: data.newValue,
    }

    translationsInputs.push(translationEntry)
  }

  public generateContentDigest(content: string): string {
    return createHash('sha256').update(content, 'utf8').digest('hex')
  }
}
