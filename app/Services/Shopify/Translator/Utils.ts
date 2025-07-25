import type { LanguageCode, RegionCode, TranslationInput } from 'Types/Translation'
import type { ResourceMedia, ResourceImage } from 'Types/Resource'
import { createHash } from 'crypto'
export default class Utils {
  private marketMap = {
    UK: '100549755227',
  }

  public createTranslationEntry(
    data: {
      key: string
      isoCode: LanguageCode
      newValue: string
      oldValue: string
    },
    translationsInputs: TranslationInput[],
    region?: RegionCode
  ): void {
    const translationEntry = {
      key: data.key,
      locale: data.isoCode,
      translatableContentDigest: this.generateContentDigest(data.oldValue),
      value: data.newValue,
    } as TranslationInput

    if (region) {
      translationEntry.marketId = this.getMarketId(region)
    }

    translationsInputs.push(translationEntry)
  }

  public generateContentDigest(content: string): string {
    return createHash('sha256').update(content, 'utf8').digest('hex')
  }

  public getMarketId(region: RegionCode): string {
    return 'gid://shopify/Market/' + this.marketMap[region]
  }

  public isResourceMedia(data: ResourceMedia | ResourceImage): data is ResourceMedia {
    return 'alts' in data
  }
}
