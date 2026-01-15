export interface IProductPublisher {
  // Core generation methods
  generateAlt(
    imageUrl: string,
    collectionTitle: string,
    productType: string
  ): Promise<{ alt: string; filename: string }>

  generateHtmlDescription(
    imageUrl: string,
    collectionTitle: string,
    productType: string
  ): Promise<string>

  generateTitleAndSeo(
    descriptionHtml: string,
    collectionTitle: string,
    productType: string
  ): Promise<{
    shortTitle: string
    title: string
    metaTitle: string
    metaDescription: string
  }>

  suggestTags(
    tags: string[],
    imageUrl: string,
    collectionTitle: string,
    productType: string
  ): Promise<string[]>

  // Mockup generation
  generateMockupAlt(
    mockupContext: string,
    metadata: MockupMetadata
  ): Promise<{ alt: string; filename: string }>
}

export interface MockupMetadata {
  mainAlt: string
  description: string
  title: string
  tags: string[]
  collectionTitle: string
  productType: 'poster' | 'painting' | 'tapestry'
}
