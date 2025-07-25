import type { LanguageCode } from 'Types/Translation'
import Authentication from '../Authentication'
export default class PullDataModeler extends Authentication {
  protected cleanResourceEmptyFields(object: any): any {
    if (Array.isArray(object)) {
      // Clean each element and filter out empty ones
      const cleanedArray = object
        .map((item) => this.cleanResourceEmptyFields(item))
        .filter((item) => !this.isEmptyField(item))
      return cleanedArray.length > 0 ? cleanedArray : null
    } else if (typeof object === 'object' && object !== null) {
      for (const key of Object.keys(object)) {
        const value = object[key]
        if (this.isEmptyField(value)) {
          delete object[key]
        } else if (typeof value === 'object' && value !== null) {
          const cleanedValue = this.cleanResourceEmptyFields(value)
          if (this.isEmptyField(cleanedValue)) {
            delete object[key]
          } else {
            object[key] = cleanedValue
          }
        }
      }
      return this.isEmptyField(object) ? null : object
    }
    return object
  }

  protected isEmptyField(field: any): boolean {
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

  protected getMetaobjectQuery(metaobjectId: string, locale: LanguageCode) {
    return {
      query: `query GetMetaobject($id: ID!) {
        translatableResource(resourceId: $id) {
          translations(locale: "${locale}") {
            key
            locale
            value
            outdated
            updatedAt
          }
        }
      }`,
      variables: { id: metaobjectId },
    }
  }
}
