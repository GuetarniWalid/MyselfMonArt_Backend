import { BaseCommand, flags } from '@adonisjs/core/build/standalone'
import Shopify from 'App/Services/Shopify'

/**
 * One-off data repair for the color-pattern metaobjects feeding the storefront color filter:
 *
 * 1. MERGE DUPLICATES — the catalog carries two "Marron / Terre" metaobjects and a legacy
 *    "Or" alongside "Doré / Or". Every product referencing a duplicate is repointed to the
 *    canonical metaobject (in BOTH metafields: shopify.color-pattern and painting.color),
 *    then the duplicate metaobject is deleted (status DRAFT as fallback if deletion fails).
 *
 * 2. FIX NOIR & BLANC TAXONOMY — the "Noir & Blanc" metaobject's color_taxonomy_reference
 *    pointed to Navy (wrong data: B&W artworks leaked as "navy" into taxonomy consumers;
 *    Navy was a "parking" base so the value formed its own S&D group). Shopify REQUIRES at
 *    least one base color (empty list and unset are both rejected), so the truthful value
 *    is [Black, White]. CAVEAT: with that base, S&D AUTO grouping merges the value into the
 *    Noir/Blanc groups — but "Noir & Blanc" is a DELIBERATE distinct facet (OR-combined
 *    filters: white-dominant / black-dominant / B&W are three different intents). The
 *    distinct facet must therefore be enforced in S&D itself (Manual grouping: keep the
 *    B&W metaobject in its own group) or by filtering on a custom metaobject type — never
 *    by reverting this reference to a lie.
 *
 *   node ace shopify:fix_color_data --dry-run
 *   node ace shopify:fix_color_data
 */
export default class ShopifyFixColorData extends BaseCommand {
  public static commandName = 'shopify:fix_color_data'
  public static description = 'Merge duplicate color metaobjects (repoint products, delete dupes) and fix the Noir & Blanc taxonomy reference'
  public static settings = { loadApp: true, stayAlive: false }

  @flags.boolean({ description: 'Report what would change without writing' })
  public dryRun: boolean

  private static CANONICAL_MARRON = 'gid://shopify/Metaobject/262968181083'
  private static CANONICAL_DORE_OR = 'gid://shopify/Metaobject/264048738651'
  private static NOIR_BLANC = 'gid://shopify/Metaobject/264624308571'
  // Truthful base colors (platform requires >= 1; see header caveat about S&D grouping).
  private static NOIR_BLANC_REFS = '["gid://shopify/TaxonomyValue/1","gid://shopify/TaxonomyValue/3"]'

  public async run() {
    const shopify = new Shopify()
    const metaobjects = await shopify.metaobject.getAll('shopify--color-pattern')
    this.logger.info(`Color metaobjects: ${metaobjects.length}`)
    for (const m of metaobjects) {
      const label = m.fields?.find((f) => f.key === 'label')?.value ?? '?'
      const colorRef = m.fields?.find((f) => f.key === 'color_taxonomy_reference')?.value ?? '-'
      this.logger.info(`  ${m.id} | "${label}" | refs=${colorRef}`)
    }

    // ---- 1. Build the duplicate → canonical map
    const replaceMap = new Map<string, string>()
    for (const m of metaobjects) {
      const label = (m.fields?.find((f) => f.key === 'label')?.value ?? '').trim()
      if (label === 'Marron / Terre' && m.id !== ShopifyFixColorData.CANONICAL_MARRON) {
        replaceMap.set(m.id, ShopifyFixColorData.CANONICAL_MARRON)
      }
      if (label === 'Or' && m.id !== ShopifyFixColorData.CANONICAL_DORE_OR) {
        replaceMap.set(m.id, ShopifyFixColorData.CANONICAL_DORE_OR)
      }
    }
    this.logger.info(`Duplicates to merge: ${replaceMap.size}`)
    for (const [dupe, keep] of replaceMap) this.logger.info(`  ${dupe} → ${keep}`)

    // ---- 2. Repoint products referencing a duplicate (both metafields)
    if (replaceMap.size > 0) {
      const products = await shopify.product.getAllProductsWithMetafield('shopify', 'color-pattern')
      const impacted = products.filter((p) => {
        try {
          const gids = JSON.parse(p.value) as string[]
          return gids.some((g) => replaceMap.has(g))
        } catch {
          return false
        }
      })
      this.logger.info(`Products referencing a duplicate: ${impacted.length}`)

      if (!this.dryRun) {
        let ok = 0
        for (const p of impacted) {
          try {
            const gids = JSON.parse(p.value) as string[]
            const replaced = gids.map((g) => replaceMap.get(g) ?? g)
            const deduped = [...new Set(replaced)]
            const newValue = JSON.stringify(deduped)
            await shopify.metafield.update(p.id, 'shopify', 'color-pattern', newValue)
            await shopify.metafield.update(p.id, 'painting', 'color', newValue)
            ok++
          } catch (error: any) {
            this.logger.error(`[${p.id}] ${error?.message ?? error}`)
          }
        }
        this.logger.success(`Repointed ${ok}/${impacted.length} products (both metafields)`)

        // ---- 3. Delete the now-unreferenced duplicates (fallback: DRAFT)
        for (const dupe of replaceMap.keys()) {
          const res = await shopify.metaobject.delete(dupe)
          const errs = res.userErrors ?? []
          if (errs.length) {
            this.logger.warning(`Delete failed for ${dupe} (${errs.map((e: any) => e.message).join('; ')}) — setting DRAFT`)
            try {
              await shopify.metaobject.updateStatus(dupe, 'DRAFT')
              this.logger.success(`  ${dupe} set to DRAFT`)
            } catch (error: any) {
              this.logger.error(`  DRAFT failed too: ${error?.message ?? error}`)
            }
          } else {
            this.logger.success(`Deleted duplicate ${res.deletedId}`)
          }
        }
      }
    }

    // ---- 4. Fix Noir & Blanc taxonomy reference ([Black, White]; facet handled in S&D)
    const nb = metaobjects.find((m) => m.id === ShopifyFixColorData.NOIR_BLANC)
    const currentRef = nb?.fields?.find((f) => f.key === 'color_taxonomy_reference')?.value
    this.logger.info(`Noir & Blanc current color_taxonomy_reference: ${currentRef}`)
    if (currentRef === ShopifyFixColorData.NOIR_BLANC_REFS) {
      this.logger.info('Already [Black, White] — nothing to do.')
    } else if (!this.dryRun) {
      const res = await shopify.metaobject.updateField(
        ShopifyFixColorData.NOIR_BLANC,
        'color_taxonomy_reference',
        ShopifyFixColorData.NOIR_BLANC_REFS
      )
      const errs = res.userErrors ?? []
      if (errs.length) this.logger.error(`Taxonomy fix failed: ${errs.map((e: any) => e.message).join('; ')}`)
      else this.logger.success('Noir & Blanc base color reference cleared (distinct facet restored)')
    }

    this.logger.info(this.dryRun ? 'Dry run complete — nothing written.' : 'Done.')
  }
}
