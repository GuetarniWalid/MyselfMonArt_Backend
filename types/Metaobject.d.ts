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
