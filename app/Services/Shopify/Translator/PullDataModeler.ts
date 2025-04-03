import type { LanguageCode } from 'Types/Translation'
import Authentication from '../Authentication'
export default class PullDataModeler extends Authentication {
  protected cleanResourceEmptyFields(object: { [key: string]: any }) {
    for (const key of Object.keys(object)) {
      const value = object[key]
      if (this.isEmptyField(value)) {
        delete object[key]
      } else if (typeof value === 'object' && value !== null) {
        this.cleanResourceEmptyFields(value)

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
