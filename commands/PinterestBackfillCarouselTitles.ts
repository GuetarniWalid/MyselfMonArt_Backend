import { BaseCommand, flags } from '@adonisjs/core/build/standalone'
import type { CarouselSlot, PinterestPin } from 'Types/Pinterest'
import Pinterest from 'App/Services/Pinterest'
import PinFormatter from 'App/Services/Pinterest/PinFormatter'

/**
 * Rattrape les carrousels déjà publiés sans titre.
 *
 * Pinterest affiche, sur un carrousel, le titre porté par CHAQUE diapositive et
 * non celui du pin. Les carrousels créés avant le correctif de PinFormatter
 * partaient donc muets, alors même que le pin avait bien un titre. Cette
 * commande relit les pins, repère les diapositives sans titre et les complète
 * via PATCH /v5/pins/{id} (`carousel_slots`), en réutilisant le titre, la
 * description et le lien du pin lui-même — aucune régénération de texte, donc
 * aucun appel au modèle.
 */
export default class PinterestBackfillCarouselTitles extends BaseCommand {
  public static commandName = 'pinterest:backfill_carousel_titles'
  public static description =
    'Ajoute le titre manquant sur les diapositives des carrousels Pinterest déjà publiés. Sans --yes, se contente de lister ce qui serait corrigé.'

  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  @flags.boolean({
    description: 'Applique réellement les corrections. Sans ce drapeau, simple simulation.',
  })
  public yes: boolean

  @flags.number({
    description: 'Nombre maximum de pins à corriger (utile pour un essai prudent).',
  })
  public limit: number

  public async run() {
    const pinterest = new Pinterest([])
    await pinterest.initialize()

    const pins = await pinterest.fetcher.getAllPins()
    const carousels = pins.filter((pin) => pin.media?.media_type === 'multiple_images')
    const needsTitle = carousels.filter((pin) =>
      PinterestBackfillCarouselTitles.isMissingTitle(pin)
    )

    this.logger.info(
      `${pins.length} pins au total, ${carousels.length} carrousels, ${needsTitle.length} sans titre de diapositive.`
    )

    if (needsTitle.length === 0) {
      this.logger.success('Rien à corriger.')
      return
    }

    const targets = this.limit ? needsTitle.slice(0, this.limit) : needsTitle

    if (!this.yes) {
      for (const pin of targets) {
        this.logger.info(
          `[SIMULATION] pin ${pin.id} (${pin.media?.items?.length ?? 0} diapos) → « ${pin.title} »`
        )
      }
      this.logger.warning(`Relancer avec --yes pour appliquer sur ${targets.length} pin(s).`)
      return
    }

    let fixed = 0
    const failures: Array<{ id: string; reason: string }> = []

    for (const pin of targets) {
      const slotCount = pin.media?.items?.length ?? 0
      if (slotCount === 0) {
        failures.push({ id: pin.id, reason: 'aucune diapositive renvoyée par l’API' })
        continue
      }
      const slot: CarouselSlot = PinFormatter.buildCarouselSlot(
        pin.title,
        pin.description,
        pin.link
      )
      try {
        await pinterest.poster.updatePin(pin.id, {
          carousel_slots: Array.from({ length: slotCount }, () => ({ ...slot })),
        })
        fixed++
        this.logger.success(`pin ${pin.id} corrigé (${slotCount} diapos) → « ${slot.title} »`)
      } catch (error) {
        const reason = (error as any)?.message ?? String(error)
        failures.push({ id: pin.id, reason })
        this.logger.error(`pin ${pin.id} en échec : ${reason}`)
      }
    }

    this.logger.info(`Terminé : ${fixed} corrigé(s), ${failures.length} en échec.`)
    if (failures.length > 0) {
      for (const failure of failures) {
        this.logger.warning(`  ${failure.id} — ${failure.reason}`)
      }
    }
  }

  /** Un carrousel est à corriger dès qu'une seule de ses diapositives n'a pas de titre. */
  private static isMissingTitle(pin: PinterestPin): boolean {
    const items = pin.media?.items ?? []
    if (items.length === 0) return false
    return items.some((item) => !item.title || item.title.trim().length === 0)
  }
}
