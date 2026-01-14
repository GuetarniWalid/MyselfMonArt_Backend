export interface ExtensionRequest {
  images: Array<{
    base64Image: string
    mockupContext?: string
    type: ImageType
  }>
  ratio: Ratio
  productType: ProductType
  parentCollection: {
    id: string
    title: string
  }
}

export type Ratio = 'portrait' | 'landscape' | 'square'

export type ImageType = 'mockup' | 'original'

export type ProductType = 'painting' | 'poster' | 'tapestry'

export interface ImageToPublish {
  url: string
  alt: string
}
