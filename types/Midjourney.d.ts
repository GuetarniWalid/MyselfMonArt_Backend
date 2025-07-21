export interface ExtensionRequest {
  aspectRatio?: string
  base64Image: string
  prompt: string
}

export type Ratio = 'portrait' | 'landscape' | 'square'

export interface ImageToPublish {
  url: string
  alt: string
}

export interface Background {
  path: string
  description: string
  portrait: BackgroundRatio
  landscape: BackgroundRatio
  square: BackgroundRatio
  topLayer: string | null
}

export interface BackgroundRatio {
  x: number
  y: number
  width: number
  height: number
}
