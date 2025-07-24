import type { Collection } from 'Types/Collection'
import type { LanguageCode } from 'Types/Translation'
import type { Page } from 'Types/Page'
import type { Product } from 'Types/Product'
import type { Resource as ResourceType } from 'Types/Resource'
import { logTaskBoundary } from 'App/Utils/Logs'
import Shopify from 'App/Services/Shopify'
import { BaseTask, CronTimeV2 } from 'adonis5-scheduler/build/src/Scheduler/Task'

export default class AddTranslationHandleMetafields extends BaseTask {
  public static get schedule() {
    return CronTimeV2.everyDayAt(1, 30)
  }

  public static get useLock() {
    return false
  }

  public async handle() {
    logTaskBoundary(true, 'Fill metafield translation handle')
    const languages: LanguageCode[] = ['fr', 'en']

    const shopify = new Shopify()

    // Products
    const products = await shopify.product.getAll()
    const productsWithoutHandleTranslation = this.getResourcessWithoutHandleTranslation(
      products,
      languages
    )
    for (const product of productsWithoutHandleTranslation) {
      await this.fillMetafieldTranslationHandle(product, 'product', languages)
    }

    // Collections
    const collections = await shopify.collection.getAll()
    const collectionsWithoutHandleTranslation = this.getResourcessWithoutHandleTranslation(
      collections,
      languages
    )
    for (const collection of collectionsWithoutHandleTranslation) {
      await this.fillMetafieldTranslationHandle(collection, 'collection', languages)
    }

    // Pages
    const pages = await shopify.page.getAll()
    const pagesWithoutHandleTranslation = this.getResourcessWithoutHandleTranslation(
      pages,
      languages
    )
    for (const page of pagesWithoutHandleTranslation) {
      await this.fillMetafieldTranslationHandle(page, 'page', languages)
    }

    logTaskBoundary(false, 'Fill metafield translation handle')
  }

  private getResourcessWithoutHandleTranslation(
    resources: Product[] | Collection[] | Page[],
    languages: LanguageCode[]
  ) {
    return resources.filter((resource) => {
      const metafields = resource.metafields.edges.map((edge) => edge.node)
      const metafieldTranslationHandle = metafields.find(
        (metafield) => metafield.namespace === 'translation' && metafield.key === 'handle'
      )

      if (!metafieldTranslationHandle) {
        return true
      }

      if (!metafieldTranslationHandle.value) {
        return true
      }

      const metafieldTranslationHandleValue = JSON.parse(metafieldTranslationHandle.value)
      for (const language of languages) {
        if (!metafieldTranslationHandleValue[language]) {
          return true
        }
      }

      return false
    })
  }

  private async fillMetafieldTranslationHandle(
    resource: Product | Collection | Page,
    resourceType: ResourceType,
    languages: LanguageCode[]
  ) {
    const metafieldTranslationHandle = {}

    for (const language of languages) {
      const handleTranslated = this.getHandleTranslated(resource, language)
      const handle = this.formatMetafieldTranslationHandle(handleTranslated, resourceType, language)
      metafieldTranslationHandle[language] = handle
    }

    const shopify = new Shopify()
    return this.retryOnThrottle(
      () =>
        shopify[resourceType].update(resource.id, {
          metafields: [
            {
              namespace: 'translation',
              key: 'handle',
              type: 'json',
              value: JSON.stringify(metafieldTranslationHandle),
            },
          ],
        }) as Promise<{ id: string }>
    )
  }

  private getHandleTranslated(
    resource: Product | Collection | Page,
    language: LanguageCode
  ): string {
    if (language === 'fr') {
      return resource.handle
    }

    const handleTranslated = resource.translations.find(
      (translation) => translation.locale === language && translation.key === 'handle'
    )
    return handleTranslated?.value || ''
  }

  private formatMetafieldTranslationHandle(
    handle: string,
    resourceType: ResourceType,
    language: LanguageCode
  ) {
    let handleFormatted = ''

    if (language !== 'fr') {
      handleFormatted = '/' + language
    }

    switch (resourceType) {
      case 'product':
        handleFormatted = handleFormatted + '/products/' + handle
        break
      case 'collection':
        handleFormatted = handleFormatted + '/collections/' + handle
        break
      case 'page':
        handleFormatted = handleFormatted + '/pages/' + handle
        break
      default:
        handleFormatted = handleFormatted + '/' + handle
    }

    return handleFormatted
  }

  private async retryOnThrottle<T>(
    fn: () => Promise<T>,
    maxRetries = 10,
    delayMs = 5000
  ): Promise<T> {
    let attempt = 0
    while (attempt < maxRetries) {
      try {
        return await fn()
      } catch (error) {
        if (error instanceof Error && error.message && error.message.includes('Throttled')) {
          attempt++
          if (attempt >= maxRetries) {
            throw new Error('Max retry attempts reached for throttled request')
          }
          console.warn(
            `Throttled by Shopify API. Retrying in ${delayMs / 1000} seconds... (attempt ${attempt})`
          )
          await new Promise((resolve) => setTimeout(resolve, delayMs))
        } else {
          throw error
        }
      }
    }
    throw new Error('Max retry attempts reached for throttled request')
  }
}
