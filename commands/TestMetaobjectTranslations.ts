import { BaseCommand, args, flags } from '@adonisjs/core/build/standalone'
import ChatGPT from 'App/Services/ChatGPT'
import Shopify from 'App/Services/Shopify'
import { logTaskBoundary } from 'App/Utils/Logs'
import { MetaobjectToTranslate } from 'Types/Metaobject'
import type { LanguageCode, RegionCode } from 'Types/Translation'

export default class TestMetaobjectTranslations extends BaseCommand {
  public static commandName = 'test:metaobject_translations'
  public static description = 'Test metaobject translations for colors and themes'

  @args.string({ description: 'Target language code (en, es, de)', required: false })
  public locale: LanguageCode

  @flags.string({ description: 'Region code (e.g., UK for en-UK)' })
  public region: RegionCode

  @flags.boolean({
    description: 'Only show colors',
    alias: 'c',
  })
  public colorsOnly: boolean

  @flags.boolean({
    description: 'Only show themes',
    alias: 't',
  })
  public themesOnly: boolean

  @flags.boolean({
    description: 'Dry run - show what would be translated without actually translating',
    alias: 'd',
  })
  public dryRun: boolean

  @flags.number({
    description: 'Limit number of metaobjects to translate',
    alias: 'l',
  })
  public limit: number

  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  public async run() {
    logTaskBoundary(true, 'Test Metaobject Translations')

    const targetLocale = this.locale || 'en'
    const targetRegion = this.region

    console.info(`\n${'='.repeat(60)}`)
    console.info(`🧪 TEST METAOBJECT TRANSLATIONS`)
    console.info(`${'='.repeat(60)}`)
    console.info(`Target Language: ${targetLocale}${targetRegion ? `-${targetRegion}` : ''}`)
    console.info(`Mode: ${this.dryRun ? '🔍 DRY RUN (no changes)' : '✅ LIVE'}`)
    if (this.colorsOnly) console.info(`Filter: Colors only`)
    if (this.themesOnly) console.info(`Filter: Themes only`)
    if (this.limit) console.info(`Limit: ${this.limit} metaobjects`)
    console.info(`${'='.repeat(60)}\n`)

    try {
      const shopify = new Shopify()
      const chatGPT = new ChatGPT()

      // Fetch metaobjects that need translation
      console.info(`📥 Fetching metaobjects that need translation...`)
      const allMetaobjectsToTranslate = (await shopify
        .translator('metaobject')
        .getOutdatedTranslations(targetLocale, targetRegion)) as MetaobjectToTranslate[]

      // Filter for colors and themes only
      let metaobjectsToTranslate = allMetaobjectsToTranslate.filter((metaobject) => {
        if (this.colorsOnly) {
          return metaobject.type === 'shopify--color-pattern'
        }
        if (this.themesOnly) {
          return metaobject.type === 'shopify--theme'
        }
        return metaobject.type === 'shopify--color-pattern' || metaobject.type === 'shopify--theme'
      })

      // Apply limit if specified
      if (this.limit && this.limit > 0) {
        metaobjectsToTranslate = metaobjectsToTranslate.slice(0, this.limit)
      }

      console.info(
        `✅ Found ${metaobjectsToTranslate.length} metaobjects to translate (${allMetaobjectsToTranslate.length} total)\n`
      )

      if (metaobjectsToTranslate.length === 0) {
        console.info(`✨ No metaobjects need translation. All up to date!`)
        logTaskBoundary(false, 'Test Metaobject Translations')
        return
      }

      // Display what will be translated
      console.info(`${'─'.repeat(60)}`)
      console.info(`📋 Metaobjects to translate:`)
      console.info(`${'─'.repeat(60)}`)

      const colorCount = metaobjectsToTranslate.filter(
        (m) => m.type === 'shopify--color-pattern'
      ).length
      const themeCount = metaobjectsToTranslate.filter((m) => m.type === 'shopify--theme').length

      console.info(`🎨 Colors: ${colorCount}`)
      console.info(`🏷️  Themes: ${themeCount}`)
      console.info(``)

      metaobjectsToTranslate.forEach((metaobject, index) => {
        const icon = metaobject.type === 'shopify--color-pattern' ? '🎨' : '🏷️'
        const typeLabel = metaobject.type === 'shopify--color-pattern' ? 'Color' : 'Theme'
        console.info(
          `${index + 1}. ${icon} ${typeLabel}: "${metaobject.field.jsonValue}" (${metaobject.id})`
        )
      })
      console.info(`${'─'.repeat(60)}\n`)

      if (this.dryRun) {
        console.info(`🔍 DRY RUN COMPLETE - No translations performed`)
        console.info(
          `Run without --dry-run flag to actually translate these ${metaobjectsToTranslate.length} metaobjects\n`
        )
        logTaskBoundary(false, 'Test Metaobject Translations')
        return
      }

      // Translate each metaobject
      console.info(`${'═'.repeat(60)}`)
      console.info(`🚀 Starting translation...`)
      console.info(`${'═'.repeat(60)}\n`)

      const results = {
        total: metaobjectsToTranslate.length,
        success: 0,
        failed: 0,
        errors: [] as Array<{ metaobject: string; error: string }>,
      }

      for (let i = 0; i < metaobjectsToTranslate.length; i++) {
        const metaobject = metaobjectsToTranslate[i]
        const progress = `[${i + 1}/${metaobjectsToTranslate.length}]`
        const icon = metaobject.type === 'shopify--color-pattern' ? '🎨' : '🏷️'

        console.info(`\n${progress} ${icon} Translating: "${metaobject.field.jsonValue}"`)
        console.info(`${progress} Type: ${metaobject.type}`)
        console.info(`${progress} ID: ${metaobject.id}`)

        try {
          // Translate
          const metaobjectTranslated = await chatGPT.translate(
            metaobject,
            'metaobject',
            targetLocale,
            targetRegion
          )

          console.info(
            `${progress} ✓ Translated to: "${(metaobjectTranslated as MetaobjectToTranslate).field.jsonValue}"`
          )

          // Update translation
          const responses = await shopify.translator('metaobject').updateTranslation({
            resourceToTranslate: metaobject,
            resourceTranslated: metaobjectTranslated,
            isoCode: targetLocale,
            region: targetRegion,
          })

          // Check for errors
          const hasErrors = responses.some(
            (response) => response.translationsRegister.userErrors.length > 0
          )

          if (hasErrors) {
            console.error(`${progress} ❌ Failed to update translation:`)
            responses.forEach((response) => {
              response.translationsRegister.userErrors.forEach((error) => {
                console.error(`${progress}    - ${error.message}`)
              })
            })
            results.failed++
            results.errors.push({
              metaobject: metaobject.field.jsonValue,
              error: 'Shopify API error',
            })
          } else {
            console.info(`${progress} ✅ Translation updated successfully`)
            results.success++
          }
        } catch (error: any) {
          console.error(`${progress} ❌ Error: ${error.message}`)
          results.failed++
          results.errors.push({
            metaobject: metaobject.field.jsonValue,
            error: error.message || String(error),
          })
        }
      }

      // Display summary
      console.info(`\n${'═'.repeat(60)}`)
      console.info(`📊 TRANSLATION SUMMARY`)
      console.info(`${'═'.repeat(60)}`)
      console.info(`Total processed: ${results.total}`)
      console.info(`✅ Successful:    ${results.success}`)
      console.info(`❌ Failed:        ${results.failed}`)
      console.info(`${'═'.repeat(60)}`)

      if (results.errors.length > 0) {
        console.error(`\n${'━'.repeat(60)}`)
        console.error(`❌ ERRORS:`)
        console.error(`${'━'.repeat(60)}`)
        results.errors.forEach((err, index) => {
          console.error(`${index + 1}. "${err.metaobject}" - ${err.error}`)
        })
        console.error(`${'━'.repeat(60)}`)
      }

      if (results.success > 0) {
        console.info(`\n🎉 Successfully translated ${results.success} metaobject(s)!`)
      }
    } catch (error: any) {
      console.error(`\n❌ Fatal error:`, error.message)
      console.error(error.stack)
    }

    logTaskBoundary(false, 'Test Metaobject Translations')
  }
}
