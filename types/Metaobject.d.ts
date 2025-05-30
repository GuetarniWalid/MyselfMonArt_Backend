export interface Metaobject {
  id: string
  handle: string
  type: string
  capabilities: {
    publishable: {
      status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED'
    }
  }
  fields: {
    key: string
    value: string
  }[]
}

export interface MetaobjectToTranslate {
  id: string
  displayName: string
  type: string
  field: {
    key: string
    type: string
    jsonValue: string
  }
}

export interface MetaobjectToTranslateFormatted {
  title: string
  description: string
  alt: string
}
