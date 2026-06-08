import type { LanguageCode } from 'Types/Translation'
import Authentication from 'App/Services/Shopify/Authentication'

/**
 * Rewrites internal storefront links inside translated HTML so they point at the
 * locale-equivalent page instead of the French source page.
 *
 * Why this exists: the ChatGPT translator translates visible link text but does NOT
 * reliably rewrite the `href`. A French URL such as
 *   https://www.myselfmonart.com/blogs/tableau-fleurs/l-art-de-fleurir-...
 * left untouched on an English page sends visitors back to French content. The
 * English equivalent differs in BOTH the locale prefix (`/en/`) and the handle
 * (`tableau-fleurs` -> `flower-wall-art`, the article handle is translated too).
 *
 * Resolution is deterministic: each French handle is looked up in Shopify and its
 * registered translated `handle` for the target locale is used. Unresolvable links
 * (already localized, external, or unknown) are left untouched.
 */
export default class LinkLocalizer extends Authentication {
  private locale: LanguageCode
  private storeHost = 'www.myselfmonart.com'
  private base = 'https://www.myselfmonart.com'
  // locale segments we recognise as a leading path prefix to strip before matching
  private localeSegments = new Set(['en', 'fr', 'es', 'de', 'nl'])

  // caches (per instance / per run)
  private collectionCache = new Map<string, string | null>()
  private productCache = new Map<string, string | null>()
  private pageMap: Map<string, string> | null = null
  private blogMap: Map<string, { id: string; enHandle: string | null }> | null = null
  private articleMaps = new Map<string, Map<string, string>>() // blogId -> (frHandle -> enHandle)

  constructor(locale: LanguageCode = 'en') {
    super()
    this.locale = locale
  }

  /**
   * Localizes every internal `href` found in the given HTML. Returns the HTML with
   * rewritten links (original HTML if nothing resolved). Safe to call on null/empty.
   */
  public async localizeHtml(html: string | null | undefined): Promise<string> {
    if (!html) return html || ''

    const hrefRe = /\bhref\s*=\s*("([^"]*)"|'([^']*)')/gi
    const rawHrefs = new Set<string>()
    let m: RegExpExecArray | null
    while ((m = hrefRe.exec(html)) !== null) {
      // group 2 = double-quoted value, group 3 = single-quoted value
      rawHrefs.add(m[2] ?? m[3] ?? '')
    }

    const replacements = new Map<string, string>()
    for (const raw of rawHrefs) {
      try {
        const localized = await this.localizeUrl(raw)
        if (localized && localized !== raw) replacements.set(raw, localized)
      } catch (error) {
        console.warn(`[LinkLocalizer] failed to localize "${raw}": ${error.message}`)
      }
    }

    if (replacements.size === 0) return html

    let result = html
    for (const [from, to] of replacements) {
      // replace the exact attribute value (quoted) to avoid accidental substring hits
      result = result.split(`"${from}"`).join(`"${to}"`).split(`'${from}'`).join(`'${to}'`)
    }
    return result
  }

  /**
   * Resolves a single href to its localized equivalent, or null if it should stay as-is.
   */
  public async localizeUrl(rawHref: string): Promise<string | null> {
    const href = rawHref.trim()
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
      return null
    }

    // Decode the one HTML entity that legitimately appears in href attributes.
    const decoded = href.replace(/&amp;/g, '&')

    let url: URL
    try {
      url = new URL(decoded, this.base)
    } catch {
      return null
    }

    // Only internal links to the storefront.
    const host = url.hostname.replace(/^www\./, '')
    if (host !== this.storeHost.replace(/^www\./, '')) return null

    const segments = url.pathname.split('/').filter(Boolean)
    if (segments.length === 0) return null

    // Strip an existing locale prefix (e.g. /en/, /fr/) before matching the resource.
    if (this.localeSegments.has(segments[0].toLowerCase())) segments.shift()
    if (segments.length === 0) return null

    const localizedPath = await this.resolvePath(segments)
    if (!localizedPath) return null

    // Preserve the query string + fragment EXACTLY as written in the source href,
    // including its original HTML-entity encoding (e.g. `&amp;`, `&#39;`) — only the
    // path is rewritten. Round-tripping through URL.search/hash would mangle entities.
    const suffixIdx = href.search(/[?#]/)
    const rawSuffix = suffixIdx >= 0 ? href.slice(suffixIdx) : ''
    return `${this.base}/${this.locale}${localizedPath}${rawSuffix}`
  }

  /** Maps the path segments of a French URL to a localized `/type/handle` path. */
  private async resolvePath(segments: string[]): Promise<string | null> {
    // Shopify handles + resource types are always lowercase; normalize so that
    // mixed-case authored links (e.g. /Collections/Tableau-Fleurs) still resolve.
    const type = segments[0]?.toLowerCase()
    const a = segments[1]?.toLowerCase()
    const b = segments[2]?.toLowerCase()
    const c = segments[3]?.toLowerCase()

    if (type === 'collections') {
      // /collections/<h>/products/<ph>  -> product takes precedence
      if (b === 'products' && c) {
        const en = await this.resolveProduct(c)
        return en ? `/products/${en}` : null
      }
      if (a) {
        const en = await this.resolveCollection(a)
        return en ? `/collections/${en}` : null
      }
    }

    if (type === 'products' && a) {
      const en = await this.resolveProduct(a)
      return en ? `/products/${en}` : null
    }

    if (type === 'blogs' && a) {
      const blog = await this.resolveBlog(a)
      if (!blog?.enHandle) return null
      if (b) {
        const enArticle = await this.resolveArticle(blog.id, b)
        return enArticle ? `/blogs/${blog.enHandle}/${enArticle}` : null
      }
      return `/blogs/${blog.enHandle}`
    }

    if (type === 'pages' && a) {
      const en = await this.resolvePage(a)
      return en ? `/pages/${en}` : null
    }

    return null
  }

  private async resolveCollection(frHandle: string): Promise<string | null> {
    if (this.collectionCache.has(frHandle)) return this.collectionCache.get(frHandle)!
    const en = await this.resolveByHandle('collections', frHandle)
    this.collectionCache.set(frHandle, en)
    return en
  }

  private async resolveProduct(frHandle: string): Promise<string | null> {
    if (this.productCache.has(frHandle)) return this.productCache.get(frHandle)!
    const en = await this.resolveByHandle('products', frHandle)
    this.productCache.set(frHandle, en)
    return en
  }

  /** Generic `<resource>(query:"handle:..")` + inline translated handle lookup. */
  private async resolveByHandle(
    resource: 'collections' | 'products',
    frHandle: string
  ): Promise<string | null> {
    const data = await this.fetchGraphQL(
      `query($q: String!) {
        ${resource}(first: 1, query: $q) {
          edges { node { id handle translations(locale: "${this.locale}") { key value } } }
        }
      }`,
      { q: `handle:${frHandle}` }
    )
    const node = data?.[resource]?.edges?.[0]?.node
    if (!node) return null
    const en = node.translations?.find((t: any) => t.key === 'handle')?.value
    return en || null
  }

  private async resolvePage(frHandle: string): Promise<string | null> {
    if (!this.pageMap) {
      this.pageMap = new Map()
      const data = await this.fetchGraphQL(
        `query { pages(first: 250) { edges { node { handle translations(locale: "${this.locale}") { key value } } } } }`
      )
      for (const e of data?.pages?.edges || []) {
        const en = e.node.translations?.find((t: any) => t.key === 'handle')?.value
        if (en) this.pageMap.set(e.node.handle, en)
      }
    }
    return this.pageMap.get(frHandle) || null
  }

  private async resolveBlog(frHandle: string) {
    if (!this.blogMap) {
      this.blogMap = new Map()
      const data = await this.fetchGraphQL(
        `query { blogs(first: 50) { edges { node { id handle translations(locale: "${this.locale}") { key value } } } } }`
      )
      for (const e of data?.blogs?.edges || []) {
        const en = e.node.translations?.find((t: any) => t.key === 'handle')?.value || null
        this.blogMap.set(e.node.handle, { id: e.node.id, enHandle: en })
      }
    }
    return this.blogMap.get(frHandle) || null
  }

  private async resolveArticle(blogId: string, frHandle: string): Promise<string | null> {
    if (!this.articleMaps.has(blogId)) {
      const map = new Map<string, string>()
      let cursor: string | null = null
      let hasNext = true
      while (hasNext) {
        const data = await this.fetchGraphQL(
          `query($id: ID!, $cursor: String) {
            blog(id: $id) {
              articles(first: 100, after: $cursor) {
                edges { cursor node { handle translations(locale: "${this.locale}") { key value } } }
                pageInfo { hasNextPage }
              }
            }
          }`,
          { id: blogId, cursor }
        )
        const edges = data?.blog?.articles?.edges || []
        for (const e of edges) {
          const en = e.node.translations?.find((t: any) => t.key === 'handle')?.value
          if (en) map.set(e.node.handle, en)
        }
        hasNext = data?.blog?.articles?.pageInfo?.hasNextPage
        // Guard against an empty edge batch returned with hasNextPage=true.
        if (hasNext && edges.length) cursor = edges[edges.length - 1].cursor
        else hasNext = false
      }
      this.articleMaps.set(blogId, map)
    }
    return this.articleMaps.get(blogId)!.get(frHandle) || null
  }
}
