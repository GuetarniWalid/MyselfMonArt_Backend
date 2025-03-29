import type { CollectionWithOutdatedTranslations } from 'Types/Collection'

export default class PullDataModeler {
  public getCollectionWithOnlyKeyToTranslate(
    collection: CollectionWithOutdatedTranslations,
    isAltMediaOutdated: boolean
  ) {
    const { translations, ...collectionWithoutTranslations } = collection

    const mutableCollection = collectionWithoutTranslations as {
      [key: string]: any
      seo?: { title?: string; description?: string }
    }

    translations.forEach((translation) => {
      const key = this.getKeyFromTranslationKey(translation.key)
      if (!translation.outdated) {
        if (key === 'seo.title') {
          delete mutableCollection.seo?.title
        }
        if (key === 'seo.description') {
          delete mutableCollection.seo?.description
        }
        delete mutableCollection[key]
      }
    })

    const processedMedia = this.getAltMediaToTranslate(collection, isAltMediaOutdated)
    delete mutableCollection.altTextsMetaObject
    mutableCollection.image = processedMedia

    const cleanedCollection = this.cleanCollectionEmptyFields({ ...mutableCollection })
    return cleanedCollection
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

  private cleanCollectionEmptyFields(object: { [key: string]: any }) {
    for (const key of Object.keys(object)) {
      const value = object[key]
      if (this.isEmptyField(value)) {
        delete object[key]
      } else if (typeof value === 'object' && value !== null) {
        this.cleanCollectionEmptyFields(value)

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
    collection: CollectionWithOutdatedTranslations,
    isAltMediaOutdated: boolean
  ) {
    if (!isAltMediaOutdated || !collection.altTextsMetaObject) return null
    return {
      id: collection.altTextsMetaObject.reference?.id,
      altText: collection.altTextsMetaObject.reference?.field?.jsonValue[0],
    }
  }
}
