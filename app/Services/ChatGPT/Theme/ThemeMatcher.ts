import type { Metaobject } from 'Types/Metaobject'
import Shopify from 'App/Services/Shopify'

export default class ThemeMatcher {
  /**
   * Match AI-detected theme names to metaobject GIDs
   * If no match found, create new theme with Art taxonomy reference
   * Returns array of GIDs (max 4)
   */
  public async matchOrCreateThemes(
    detectedThemes: string[],
    existingMetaobjects: Metaobject[]
  ): Promise<string[]> {
    const themeGids: string[] = []

    for (const themeName of detectedThemes) {
      // Step 1: Try to find existing metaobject (fuzzy match)
      let metaobject = this.findMetaobjectByThemeName(themeName, existingMetaobjects)

      if (!metaobject) {
        // Step 2: Create new metaobject if no match
        console.info(`No existing metaobject for "${themeName}", creating new one...`)
        const newGid = await this.createThemeMetaobject(themeName)

        if (newGid) {
          themeGids.push(newGid)
          console.info(`✓ Created new theme "${themeName}" → ${newGid}`)
        } else {
          console.warn(`✗ Failed to create theme "${themeName}"`)
        }
      } else {
        themeGids.push(metaobject.id)
        console.info(`✓ Matched "${themeName}" to existing ${metaobject.id}`)
      }

      // Enforce max 4 themes
      if (themeGids.length >= 4) {
        break
      }
    }

    return themeGids
  }

  /**
   * Find metaobject by theme name
   * Checks 'label' field with fuzzy matching
   * Uses exact matching first, then fuzzy matching
   */
  private findMetaobjectByThemeName(
    themeName: string,
    metaobjects: Metaobject[]
  ): Metaobject | null {
    const normalized = this.normalizeThemeName(themeName)

    // Try exact match on label field
    const exactMatch = metaobjects.find((mo) => {
      const labelField = mo.fields.find((f) => f.key === 'label')
      return labelField && this.normalizeThemeName(labelField.value) === normalized
    })

    if (exactMatch) {
      return exactMatch
    }

    // Try fuzzy match (handle accents, spaces, plural/singular)
    const fuzzyMatch = metaobjects.find((mo) => {
      const labelField = mo.fields.find((f) => f.key === 'label')
      return labelField && this.isSimilarThemeName(themeName, labelField.value)
    })

    return fuzzyMatch || null
  }

  /**
   * Create new theme metaobject
   * Returns metaobject GID on success, null on failure
   */
  private async createThemeMetaobject(themeName: string): Promise<string | null> {
    try {
      const label = this.capitalizeFirstLetter(themeName)

      // Double-check cache to prevent race condition duplicates
      const shopify = new Shopify()
      const allThemes = await shopify.metaobject.getAll('shopify--theme')
      const existing = this.findMetaobjectByThemeName(label, allThemes)

      if (existing) {
        console.info(`Theme "${label}" already exists (found in cache refresh)`)
        return existing.id
      }

      // Create new metaobject (taxonomy_reference = Art)
      const response = await shopify.metaobject.createThemeMetaobject(label)

      if (response.userErrors?.length > 0) {
        console.error(`Failed to create theme "${label}": ${response.userErrors[0].message}`)
        return null
      }

      return response.metaobject.id
    } catch (error: any) {
      console.error(`Error creating theme "${themeName}":`, error.message)
      return null
    }
  }

  /**
   * Fuzzy theme name matching for variations
   * Handles accents, plural/singular, spacing
   */
  private isSimilarThemeName(name1: string, name2: string): boolean {
    const n1 = this.normalizeThemeName(name1)
    const n2 = this.normalizeThemeName(name2)

    // Exact match after normalization
    if (n1 === n2) {
      return true
    }

    // Handle plural/singular variations
    if (n1 + 's' === n2 || n1 === n2 + 's') {
      return true
    }

    // Handle "x" → "aux" variations (e.g., "Animal" → "Animaux")
    if (n1 + 'x' === n2 || n1 === n2.slice(0, -1)) {
      return true
    }

    return false
  }

  /**
   * Normalize theme name for comparison
   * - Lowercase
   * - Trim whitespace
   * - Remove accents
   * - Normalize spaces
   */
  private normalizeThemeName(name: string): string {
    return (
      name
        .toLowerCase()
        .trim()
        // Remove accents
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        // Normalize spaces
        .replace(/\s+/g, ' ')
    )
  }

  /**
   * Capitalize first letter, rest lowercase
   * E.g., "abstrait" → "Abstrait", "BAUHAUS" → "Bauhaus"
   */
  private capitalizeFirstLetter(str: string): string {
    if (!str) return str
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
  }
}
