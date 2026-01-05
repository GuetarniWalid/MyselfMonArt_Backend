import type { Metaobject } from 'Types/Metaobject'

export default class ColorMatcher {
  /**
   * Match AI-detected color names to metaobject GIDs
   * Skips colors that don't match any metaobject
   * Returns array of GIDs (max 3)
   */
  public matchColorsToMetaobjects(detectedColors: string[], metaobjects: Metaobject[]): string[] {
    const matchedGids: string[] = []

    for (const colorName of detectedColors) {
      const metaobject = this.findMetaobjectByColorName(colorName, metaobjects)

      if (metaobject) {
        matchedGids.push(metaobject.id)
        console.info(`✓ Matched "${colorName}" to ${metaobject.id}`)
      } else {
        console.warn(`✗ No metaobject found for color "${colorName}"`)
      }

      // Enforce max 3 colors
      if (matchedGids.length >= 3) {
        break
      }
    }

    return matchedGids
  }

  /**
   * Find metaobject by color name
   * Checks 'label' field first (French), then 'name' field, then handle
   * Uses exact matching first, then fuzzy matching for special characters
   */
  private findMetaobjectByColorName(
    colorName: string,
    metaobjects: Metaobject[]
  ): Metaobject | null {
    const normalizedColorName = this.normalizeColorName(colorName)

    // Try exact match first
    const exactMatch = metaobjects.find((mo) => {
      const labelField = mo.fields.find((f) => f.key === 'label')
      if (labelField && this.normalizeColorName(labelField.value) === normalizedColorName) {
        return true
      }

      const nameField = mo.fields.find((f) => f.key === 'name')
      if (nameField && this.normalizeColorName(nameField.value) === normalizedColorName) {
        return true
      }

      if (this.normalizeColorName(mo.handle) === normalizedColorName) {
        return true
      }

      return false
    })

    if (exactMatch) {
      return exactMatch
    }

    // Try fuzzy match (handles & ↔ et/and, / ↔ ou/or)
    const fuzzyMatch = metaobjects.find((mo) => {
      const labelField = mo.fields.find((f) => f.key === 'label')
      if (labelField && this.isSimilarColorName(colorName, labelField.value)) {
        console.info(`   ⚡ Fuzzy matched "${colorName}" to "${labelField.value}"`)
        return true
      }

      const nameField = mo.fields.find((f) => f.key === 'name')
      if (nameField && this.isSimilarColorName(colorName, nameField.value)) {
        console.info(`   ⚡ Fuzzy matched "${colorName}" to "${nameField.value}"`)
        return true
      }

      if (this.isSimilarColorName(colorName, mo.handle)) {
        console.info(`   ⚡ Fuzzy matched "${colorName}" to "${mo.handle}"`)
        return true
      }

      return false
    })

    return fuzzyMatch || null
  }

  /**
   * Fuzzy color name matching for special character variations
   * Handles common AI substitutions:
   * - & ↔ et / and
   * - / ↔ ou / or
   * - Spacing variations around special characters
   */
  private isSimilarColorName(colorName1: string, colorName2: string): boolean {
    const normalized1 = this.normalizeColorName(colorName1)
    const normalized2 = this.normalizeColorName(colorName2)

    // Already exact match (shouldn't reach here, but safe)
    if (normalized1 === normalized2) {
      return true
    }

    // Create fuzzy versions by replacing special characters
    const fuzzy1 = this.createFuzzyVariants(normalized1)
    const fuzzy2 = this.createFuzzyVariants(normalized2)

    // Check if any fuzzy variant matches
    return fuzzy1.some((variant1) => fuzzy2.some((variant2) => variant1 === variant2))
  }

  /**
   * Create fuzzy variants of a color name
   * Returns array of possible variations
   */
  private createFuzzyVariants(colorName: string): string[] {
    const variants: string[] = [colorName]

    // Variant 1: Replace & with "et" (French)
    if (colorName.includes('&')) {
      variants.push(colorName.replace(/\s*&\s*/g, ' et '))
      variants.push(colorName.replace(/\s*&\s*/g, ' and ')) // English fallback
    }

    // Variant 2: Replace "et"/"and" with &
    if (colorName.includes(' et ') || colorName.includes(' and ')) {
      variants.push(colorName.replace(/\s+(et|and)\s+/g, ' & '))
    }

    // Variant 3: Replace / with "ou" (French)
    if (colorName.includes('/')) {
      variants.push(colorName.replace(/\s*\/\s*/g, ' ou '))
      variants.push(colorName.replace(/\s*\/\s*/g, ' or ')) // English fallback
    }

    // Variant 4: Replace "ou"/"or" with /
    if (colorName.includes(' ou ') || colorName.includes(' or ')) {
      variants.push(colorName.replace(/\s+(ou|or)\s+/g, ' / '))
    }

    // Normalize all variants (remove extra spaces)
    return variants.map((v) => v.trim().replace(/\s+/g, ' '))
  }

  /**
   * Normalize color name for comparison
   * - Lowercase
   * - Trim whitespace
   * - Remove extra spaces
   */
  private normalizeColorName(colorName: string): string {
    return colorName.toLowerCase().trim().replace(/\s+/g, ' ')
  }
}
