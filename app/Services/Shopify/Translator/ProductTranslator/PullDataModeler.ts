import type { ProductWithOutdatedTranslations } from 'Types/Product'

export default class PullDataModeler {
  public getProductWithOnlyKeyToTranslate(
    product: ProductWithOutdatedTranslations,
    isAltMediaOutdated: boolean
  ) {
    const { translations, ...productWithoutTranslations } = product

    const mutableProduct = productWithoutTranslations as {
      [key: string]: any
      seo?: { title?: string; description?: string }
    }

    translations.forEach((translation) => {
      const key = this.getKeyFromTranslationKey(translation.key)
      if (!translation.outdated) {
        if (key === 'seo.title') {
          delete mutableProduct.seo?.title
        }
        if (key === 'seo.description') {
          delete mutableProduct.seo?.description
        }
        delete mutableProduct[key]
      }
    })

    const processedOptions = product.options.map((option) => {
      const processedOption = this.deleteUpToDateOptionValuesFromOption({ ...option })

      const { translations: optionTranslations, ...optionWithoutTranslations } = processedOption
      optionTranslations.forEach((translation) => {
        const key = this.getKeyFromTranslationKey(translation.key)
        if (!translation.outdated) {
          delete optionWithoutTranslations[key]
        }
      })
      return optionWithoutTranslations
    })
    mutableProduct.options = processedOptions

    const processedMedia = this.getAltMediaToTranslate(product, isAltMediaOutdated)
    delete mutableProduct.altTextsMetaObject
    mutableProduct.media = processedMedia

    const cleanedProduct = this.cleanProductEmptyFields({ ...mutableProduct })
    return this.isEmptyField(cleanedProduct) ? null : cleanedProduct
  }

  private getKeyFromTranslationKey(key: string) {
    switch (key) {
      case 'body_html':
        return 'descriptionHtml'
      case 'product_type':
        return 'productType'
      case 'meta_title':
        return 'seo.title'
      case 'meta_description':
        return 'seo.description'
      default:
        return key
    }
  }

  private deleteUpToDateOptionValuesFromOption(
    option: ProductWithOutdatedTranslations['options'][number]
  ) {
    const optionValues = option.optionValues

    const optionValuesCleaned = optionValues.map((optionValue) => {
      const { translations, ...optionValueWithoutTranslations } = optionValue
      translations.forEach((translation) => {
        const key = this.getKeyFromTranslationKey(translation.key)
        if (!translation.outdated) {
          delete optionValueWithoutTranslations[key]
        }
      })
      return optionValueWithoutTranslations
    })

    return {
      ...option,
      optionValues: optionValuesCleaned.filter((value) => !this.isEmptyField(value)),
    }
  }

  private cleanProductEmptyFields(object: { [key: string]: any }) {
    for (const key of Object.keys(object)) {
      const value = object[key]
      if (this.isEmptyField(value)) {
        delete object[key]
      } else if (typeof value === 'object' && value !== null) {
        this.cleanProductEmptyFields(value)

        if (Object.keys(value).length === 0) {
          delete object[key]
        } else if (this.isEmptyField(value)) {
          delete object[key]
        }
      }
    }

    // Check if the object itse is empty
    if (this.isEmptyField(object)) {
      return null
    }
    return object
  }

  private isEmptyField(field: any): boolean {
    return (
      field === undefined ||
      field === null ||
      field === '' ||
      (typeof field === 'object' && field.length === 0) ||
      (typeof field === 'object' && Object.keys(field).length === 0) ||
      (typeof field === 'object' &&
        Object.keys(field).length === 1 &&
        Object.keys(field)[0] === 'id')
    )
  }

  private getAltMediaToTranslate(
    product: ProductWithOutdatedTranslations,
    isAltMediaOutdated: boolean
  ) {
    if (!isAltMediaOutdated || !product.altTextsMetaObject) return null
    return {
      id: product.altTextsMetaObject.reference?.id,
      alts: product.altTextsMetaObject.reference?.field?.jsonValue,
    }
  }
}
