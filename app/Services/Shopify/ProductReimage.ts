import Authentication from './Authentication'

// Service dédié au mode « reimage » du Publisher : recherche du produit à refaire,
// contexte (orientation, type, collection, images actuelles) et utilitaires pour le
// remplacement des images. Les requêtes GraphQL nouvelles vivent ici pour ne pas
// toucher app/Services/Shopify/Product/index.ts (chantier parallèle non commité).

export type ReimageOrientation = 'portrait' | 'landscape' | 'square'
export type ReimageProductType = 'painting' | 'poster' | 'tapestry'

export interface ReimageProductSummary {
  id: string
  title: string
  status: string
  image: string | null
}

export interface ReimageContext {
  id: string
  title: string
  status: string
  orientation: ReimageOrientation | null
  productType: ReimageProductType | null
  collection: { id: string; title: string } | null
  images: Array<{ id: string; url: string | null; alt: string | null }>
  hasVideo: boolean
}

export interface ReplaceContext {
  id: string
  title: string
  descriptionText: string
  tags: string[]
  productType: ReimageProductType | null
  collectionTitle: string
  onlineStoreUrl: string | null
  imageMediaIds: string[]
  hasVideo: boolean
}

export default class ProductReimage extends Authentication {
  /**
   * Recherche de produits pour le combo du mode reimage.
   * q vide => les 20 produits les plus récemment modifiés.
   */
  public async searchProducts(q?: string): Promise<ReimageProductSummary[]> {
    const query = `query ReimageSearchProducts($q: String) {
      products(first: 20, query: $q, sortKey: UPDATED_AT, reverse: true) {
        nodes {
          id
          title
          status
          featuredImage {
            url(transform: { maxWidth: 160, maxHeight: 160 })
          }
        }
      }
    }`
    const trimmed = (q || '').trim()
    const data = await this.fetchGraphQL(query, { q: trimmed.length ? trimmed : null }, 50)

    return (data.products?.nodes || []).map((node: any) => ({
      id: node.id,
      title: node.title,
      status: node.status,
      image: node.featuredImage?.url || null,
    }))
  }

  /**
   * Contexte d'un produit pour le front reimage : orientation (parsée depuis la
   * 1re variante), type de produit (metafield artwork.type), collection parente
   * (metafield link.mother_collection, fallback 1re collection), images actuelles.
   */
  public async getReimageContext(productId: string): Promise<ReimageContext | null> {
    const query = `query ReimageContext($id: ID!) {
      product(id: $id) {
        id
        title
        status
        artworkTypeMetafield: metafield(namespace: "artwork", key: "type") {
          value
        }
        motherCollectionMetafield: metafield(namespace: "link", key: "mother_collection") {
          reference {
            ... on Collection {
              id
              title
            }
          }
        }
        collections(first: 1) {
          nodes {
            id
            title
          }
        }
        media(first: 250) {
          nodes {
            id
            alt
            mediaContentType
            ... on MediaImage {
              image {
                url(transform: { maxWidth: 200, maxHeight: 200 })
              }
            }
          }
        }
        variants(first: 1) {
          nodes {
            selectedOptions {
              name
              value
            }
          }
        }
      }
    }`
    const data = await this.fetchGraphQL(query, { id: this.normalizeProductId(productId) }, 100)
    const product = data.product
    if (!product) {
      return null
    }

    const mediaNodes: any[] = product.media?.nodes || []
    const images = mediaNodes
      .filter((node) => node.mediaContentType === 'IMAGE')
      .map((node) => ({
        id: node.id,
        url: node.image?.url || null,
        alt: node.alt || null,
      }))

    return {
      id: product.id,
      title: product.title,
      status: product.status,
      orientation: this.parseOrientation(product.variants?.nodes?.[0]),
      productType: this.normalizeProductType(product.artworkTypeMetafield?.value),
      collection: this.resolveCollection(product),
      images,
      hasVideo: mediaNodes.some((node) => node.mediaContentType !== 'IMAGE'),
    }
  }

  /**
   * Contexte frais pour le remplacement des images : données existantes du produit
   * (titre, description en texte brut, tags…) + ids des médias IMAGE à supprimer
   * après bascule. La description sert de contexte aux alts IA (tronquée à ~600 chars).
   */
  public async getReplaceContext(productId: string): Promise<ReplaceContext | null> {
    const query = `query ReimageReplaceContext($id: ID!) {
      product(id: $id) {
        id
        title
        descriptionHtml
        tags
        onlineStoreUrl
        artworkTypeMetafield: metafield(namespace: "artwork", key: "type") {
          value
        }
        motherCollectionMetafield: metafield(namespace: "link", key: "mother_collection") {
          reference {
            ... on Collection {
              id
              title
            }
          }
        }
        collections(first: 1) {
          nodes {
            id
            title
          }
        }
        media(first: 250) {
          nodes {
            id
            mediaContentType
          }
        }
      }
    }`
    const data = await this.fetchGraphQL(query, { id: this.normalizeProductId(productId) }, 100)
    const product = data.product
    if (!product) {
      return null
    }

    const mediaNodes: any[] = product.media?.nodes || []
    const collection = this.resolveCollection(product)

    return {
      id: product.id,
      title: product.title,
      descriptionText: this.htmlToPlainText(product.descriptionHtml || '', 600),
      tags: product.tags || [],
      productType: this.normalizeProductType(product.artworkTypeMetafield?.value),
      collectionTitle: collection?.title || '',
      onlineStoreUrl: product.onlineStoreUrl || null,
      imageMediaIds: mediaNodes
        .filter((node) => node.mediaContentType === 'IMAGE')
        .map((node) => node.id),
      hasVideo: mediaNodes.some((node) => node.mediaContentType !== 'IMAGE'),
    }
  }

  /**
   * Liste ordonnée des médias d'un produit (pour vérifier l'ordre final après
   * remplacement et décider d'un reorderMedia).
   */
  public async listMedia(
    productId: string
  ): Promise<Array<{ id: string; mediaContentType: string }>> {
    const query = `query ReimageListMedia($id: ID!) {
      product(id: $id) {
        id
        media(first: 250) {
          nodes {
            id
            mediaContentType
          }
        }
      }
    }`
    const data = await this.fetchGraphQL(query, { id: this.normalizeProductId(productId) }, 50)
    return (data.product?.media?.nodes || []).map((node: any) => ({
      id: node.id,
      mediaContentType: node.mediaContentType,
    }))
  }

  /**
   * Poll du statut de médias PRÉCIS (les nouveaux médias du remplacement), même
   * mécanique que Product.waitForMediaProcessing mais scoping par ids : pendant un
   * remplacement le produit porte temporairement anciens + nouveaux médias, et le
   * helper existant ne lit que les 20 premiers (les nouveaux, en fin de liste,
   * pourraient être ignorés). failedMedia ne contient que des ids suivis.
   */
  public async waitForNewMediaProcessing(
    productId: string,
    mediaIds: string[],
    maxAttempts: number = 30,
    intervalMs: number = 2000
  ): Promise<{ allReady: boolean; failedMedia: string[] }> {
    const query = `query ReimageMediaStatus($id: ID!) {
      product(id: $id) {
        id
        media(first: 250) {
          nodes {
            id
            status
          }
        }
      }
    }`
    const id = this.normalizeProductId(productId)

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const data = await this.fetchGraphQL(query, { id }, 50)
      const nodes: any[] = data.product?.media?.nodes || []
      const tracked = nodes.filter((node) => mediaIds.includes(node.id))
      // Garde-fou du chemin destructif : un média suivi absent de la page ne doit
      // JAMAIS passer pour prêt — on continue à poller, et au timeout on retombe
      // sur le chemin conservateur (anciennes images conservées + alerte).
      const missing = mediaIds.length - tracked.length

      const processing = tracked.filter(
        (node) => node.status === 'PROCESSING' || node.status === 'UPLOADED'
      )
      const failed = tracked.filter((node) => node.status === 'FAILED')

      console.log(
        `[Reimage] New media status (attempt ${attempt}/${maxAttempts}): ${
          tracked.length - processing.length - failed.length
        } ready, ${processing.length} processing, ${failed.length} failed, ${missing} missing`
      )

      if (processing.length === 0 && missing === 0) {
        return { allReady: failed.length === 0, failedMedia: failed.map((node) => node.id) }
      }

      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, intervalMs))
      }
    }

    console.warn(`[Reimage] Media processing timeout after ${maxAttempts} attempts`)
    return { allReady: false, failedMedia: [] }
  }

  /** Accepte un id numérique ou un GID complet (même convention que Product). */
  private normalizeProductId(productId: string): string {
    return isNaN(Number(productId)) ? productId : `gid://shopify/Product/${productId}`
  }

  /**
   * Orientation depuis la 1re variante : une valeur d'option au format
   * « 30x40cm » => largeur < hauteur = portrait, > = paysage, = carré.
   */
  private parseOrientation(variant: any): ReimageOrientation | null {
    const options: any[] = variant?.selectedOptions || []
    for (const option of options) {
      const match = /^(\d+)\s*x\s*(\d+)\s*cm$/i.exec(String(option.value || '').trim())
      if (match) {
        const width = parseInt(match[1], 10)
        const height = parseInt(match[2], 10)
        if (width < height) return 'portrait'
        if (width > height) return 'landscape'
        return 'square'
      }
    }
    return null
  }

  private normalizeProductType(value: any): ReimageProductType | null {
    return value === 'painting' || value === 'poster' || value === 'tapestry' ? value : null
  }

  /** Collection parente : metafield link.mother_collection, sinon 1re collection du produit. */
  private resolveCollection(product: any): { id: string; title: string } | null {
    const mother = product.motherCollectionMetafield?.reference
    if (mother?.id && mother?.title) {
      return { id: mother.id, title: mother.title }
    }
    const first = product.collections?.nodes?.[0]
    if (first?.id && first?.title) {
      return { id: first.id, title: first.title }
    }
    return null
  }

  /** Description HTML -> texte brut : strip des balises, espaces normalisés, tronqué. */
  private htmlToPlainText(html: string, maxLength: number): string {
    const text = html
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#0?39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim()
    return text.length > maxLength ? `${text.substring(0, maxLength).trim()}…` : text
  }
}
