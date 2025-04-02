import { ArticleWithOutdatedTranslations } from 'Types/Article'

export default class PullDataModeler {
  public getArticleWithOnlyKeyToTranslate(
    article: ArticleWithOutdatedTranslations,
    isAltMediaOutdated: boolean
  ) {
    const { translations, ...articleWithoutTranslations } = article

    const mutableArticle = articleWithoutTranslations as {
      [key: string]: any
    }

    translations.forEach((translation) => {
      const key = this.getKeyFromTranslationKey(translation.key)
      if (!translation.outdated) {
        delete mutableArticle[key]
      }
    })

    const processedMedia = this.getAltMediaToTranslate(article, isAltMediaOutdated)
    delete mutableArticle.altTextsMetaObject
    mutableArticle.image = processedMedia

    const cleanedArticle = this.cleanArticleEmptyFields({ ...mutableArticle })
    return cleanedArticle
  }

  private getKeyFromTranslationKey(key: string) {
    switch (key) {
      case 'body_html':
        return 'body'
      case 'summary_html':
        return 'summary'
      default:
        return key
    }
  }

  private cleanArticleEmptyFields(object: { [key: string]: any }) {
    for (const key of Object.keys(object)) {
      const value = object[key]
      if (this.isEmptyField(value)) {
        delete object[key]
      } else if (typeof value === 'object' && value !== null) {
        this.cleanArticleEmptyFields(value)

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
    article: ArticleWithOutdatedTranslations,
    isAltMediaOutdated: boolean
  ) {
    if (!isAltMediaOutdated || !article.altTextsMetaObject) return null
    return {
      id: article.altTextsMetaObject.reference?.id,
      altText: article.altTextsMetaObject.reference?.field?.jsonValue[0],
    }
  }
}
