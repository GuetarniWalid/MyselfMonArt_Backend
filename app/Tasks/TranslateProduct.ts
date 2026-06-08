import type { LanguageCode, RegionCode } from 'Types/Translation'
import type { ProductToTranslate } from 'Types/Product'
import { BaseTask, CronTimeV2 } from 'adonis5-scheduler/build/src/Scheduler/Task'
import ChatGPT from 'App/Services/ChatGPT'
import Shopify from 'App/Services/Shopify'
import TranslationSkipCacheService from 'App/Services/TranslationSkipCache'
import { logTaskBoundary } from 'App/Utils/Logs'
export default class TranslateProduct extends BaseTask {
  public static get schedule() {
    return CronTimeV2.everyDayAt(3, 30)
  }

  public static get useLock() {
    return false
  }

  public async handle() {
    logTaskBoundary(true, 'Translate product')

    await this.translateTo('en')
    await this.translateTo('en', 'UK')
    await this.translateTo('de')
    await this.translateTo('es')
    // await this.translateTo('nl') // NL: backfill manuel (translate:manual) pour éviter le coût GPT — réactiver pour l'auto-heal une fois le backfill fait

    logTaskBoundary(false, 'Translate product')
  }

  private async translateTo(locale: LanguageCode, region?: RegionCode) {
    const shopify = new Shopify()
    const skipCache = new TranslationSkipCacheService()
    const productsToTranslate = await shopify
      .translator('product')
      .getOutdatedTranslations(locale, region)
    console.log('🚀 ~ products to translate length:', productsToTranslate.length)
    const chatGPT = new ChatGPT()

    for (const product of productsToTranslate) {
      console.log('============================')
      console.log('🚀 ~ Id product to translate => ', product.id)
      const productTranslated = await chatGPT.translate(product, 'product', locale, region)

      // Option values whose translation came back equal to the source (e.g. de/es echo
      // "Aluminium" → "Aluminium") are dropped by Utils.createTranslationEntry below, so
      // Shopify never registers them and keeps reporting them outdated — re-sending them
      // to ChatGPT every night forever. Record the echo in the skip cache so the next
      // pull excludes them until the source word changes. See PullDataModeler.
      await this.cacheUnchangedOptionValues(skipCache, product, productTranslated, locale, region)

      const responses = await shopify.translator('product').updateTranslation({
        resourceToTranslate: product,
        resourceTranslated: productTranslated,
        isoCode: locale,
        region,
      })
      responses.forEach((response) => {
        if (response.translationsRegister.userErrors.length > 0) {
          console.log('🚨 Error => ', response.translationsRegister.userErrors)
        } else {
          console.log('✅ Translation updated')
        }
      })
      console.log('============================')
    }
    console.log(`✅ Products translations updated to ${locale}${region ? `-${region}` : ''}`)
  }

  /**
   * After translation, mark any option value whose translated name equals its source name
   * (an unchanged echo) in the skip cache. The source product and the translated product
   * keep option values index-aligned with stable ids, so we can match them positionally.
   * The pull step honours these entries (until the source word changes) to stop the
   * value being re-translated every night for nothing.
   */
  private async cacheUnchangedOptionValues(
    skipCache: TranslationSkipCacheService,
    source: Partial<ProductToTranslate>,
    translated: Partial<ProductToTranslate>,
    locale: LanguageCode,
    region?: RegionCode
  ) {
    const sourceOptions = source.options ?? []
    const translatedOptions = translated.options ?? []

    for (const [optionIndex, option] of sourceOptions.entries()) {
      const sourceValues = option.optionValues ?? []
      const translatedValues = translatedOptions[optionIndex]?.optionValues ?? []

      for (const [valueIndex, sourceValue] of sourceValues.entries()) {
        const translatedValue = translatedValues[valueIndex]
        if (!sourceValue?.name || !translatedValue?.name) continue
        if (translatedValue.name !== sourceValue.name) continue

        await skipCache.markFailed(
          {
            resourceId: sourceValue.id,
            resourceType: 'product_option_value',
            locale,
            region,
            fieldKey: 'name',
          },
          sourceValue.name,
          'Translation equals source content'
        )
        console.log(
          `🧊 Cached option value "${sourceValue.name}" as skip — translation equals source`
        )
      }
    }
  }
}
