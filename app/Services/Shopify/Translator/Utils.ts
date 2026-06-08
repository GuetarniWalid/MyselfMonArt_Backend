import type { LanguageCode, RegionCode, TranslationInput } from 'Types/Translation'
import type { ResourceMedia, ResourceImage } from 'Types/Resource'
import { createHash } from 'crypto'
export default class Utils {
  private marketMap: Partial<Record<RegionCode, string>> = {
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
    if (data.newValue === data.oldValue) {
      console.log(
        `⏭️ Skipping translation for key "${data.key}" - translated value matches original: "${data.newValue}"`
      )
      return
    }

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
    const marketNumericId = this.marketMap[region]
    if (!marketNumericId) {
      // Fail loud instead of building 'gid://shopify/Market/undefined' (silently rejected
      // or mis-routed by Shopify). A region must be mapped before it can be translated to.
      throw new Error(
        `No Shopify Market mapped for region "${region}". Add it to Utils.marketMap ` +
          `(and config/i18n MARKET_REGION_BY_LOCALE) before translating to ${region}.`
      )
    }
    return 'gid://shopify/Market/' + marketNumericId
  }

  public isResourceMedia(data: ResourceMedia | ResourceImage): data is ResourceMedia {
    return 'alts' in data
  }
}
