export interface ExtensionRequest {
  images: Array<{
    base64Image: string
    mockupContext?: string
    type: ImageType
    // Passe-partout (jumeaux d'affiche, poster only) : identifiant client stable porté par
    // CHAQUE mockup, et — sur le jumeau maté — référence au mockup source dont on réutilise
    // l'alt/le filename (suffixe « passe-partout », zéro appel IA). Voir ShopifyProductPublishersController.
    clientId?: string
    passePartout?: boolean
    passePartoutOf?: string
    // Preuve « avant -> apres » (poster personnalise uniquement) : une demonstration, pas une mise
    // en situation -> nom de fichier marque (le theme l'exclut de l'appariage) et alt deterministe.
    proof?: boolean
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
