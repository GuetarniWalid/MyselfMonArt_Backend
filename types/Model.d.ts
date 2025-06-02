export interface ModelToTranslate {
  id: string
  key: string
  value?: string | ModelToTranslateMedia
  file?: ModelToTranslateMedia
}

export interface ModelToTranslateMedia {
  alt?: string
  fileName: string
  url: string
  oldUrl: string
}

export interface FileCreateResponse {
  fileCreate: {
    files: {
      id: string
    }[]
  }
}

export interface FileResponse {
  node: {
    image: {
      url: string
    }
  }
}
