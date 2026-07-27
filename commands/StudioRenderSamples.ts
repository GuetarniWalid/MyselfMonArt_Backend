import { BaseCommand, args, flags } from '@adonisjs/core/build/standalone'
import { randomUUID } from 'crypto'
import { promises as fs } from 'fs'
import { join, basename } from 'path'
import { DateTime } from 'luxon'

/**
 * Génère une PLANCHE DE VALIDATION pour une recette studio : quelques créations d'un coup, sur un
 * produit donné, à partir de photos locales.
 *
 * À QUOI ÇA SERT
 * Avant de basculer un produit sur le studio piloté par recette, il faut voir des rendus — plusieurs
 * options, plusieurs visages. Or l'API publique applique les plafonds anti-abus (2 essais anonymes
 * par jour et par IP, 5 avec e-mail) : ils protègent la boutique des inconnus, mais empêchent le
 * propriétaire de juger sa propre recette. Cette commande crée les créations DIRECTEMENT, sans
 * passer par ces plafonds.
 *
 * CE QU'ELLE NE CONTOURNE PAS
 * Le PLAFOND DE COÛT QUOTIDIEN est respecté, et vérifié avant chaque création : c'est le garde-fou
 * du portefeuille, pas un garde-fou anti-inconnu. Si la journée est déjà chargée, la commande
 * s'arrête net.
 *
 * CE QU'ELLE NE SIMULE PAS
 * Elle n'invente aucun raccourci de génération : elle réutilise la MÊME lecture de recette
 * (`RecipeService.forProduct`), la MÊME validation des champs (`validateGenericPayload`) et la même
 * normalisation de photo que la vraie porte client. Ensuite, c'est le worker habituel qui prend le
 * relais — même prompt, même juge, mêmes modèles. Le job créé est indiscernable de celui d'un
 * client, à ceci près que sa session est marquée `outil-interne` (voir IP_HASH_MARKER) pour rester
 * identifiable dans les statistiques.
 *
 * ⚠️ Elle COÛTE DE L'ARGENT (~0,50 € par création) : `--execute` est obligatoire pour lancer.
 *
 * FICHIER DE PLAN (JSON) — une entrée par création :
 *   [
 *     { "photo": "garcon.jpg", "fields": { "teamSlug": "psg", "playerName": "HUGO", "playerNumber": "9" } }
 *   ]
 * `fields` est passé tel quel au validateur de la recette : les noms de champs sont ceux que la
 * recette déclare, pas une liste figée ici. Une recette sans équipe (portrait de famille, horoscope)
 * se valide donc avec la même commande.
 *
 *   node ace studio:render-samples gid://shopify/Product/123 456789 --plan=/tmp/plan.json --photos=/tmp/photos
 *   node ace studio:render-samples gid://shopify/Product/123 456789 --plan=/tmp/plan.json --photos=/tmp/photos --execute
 */
export default class StudioRenderSamples extends BaseCommand {
  public static commandName = 'studio:render-samples'
  public static description =
    'Génère une planche de validation pour une recette studio (hors plafonds anti-abus)'
  public static settings = { loadApp: true, stayAlive: false }

  /**
   * Empreinte d'IP des sessions créées ici. Volontairement NON conforme au hachage des vraies
   * sessions : aucune session client ne peut la porter, donc ces créations ne consomment le quota
   * d'aucun visiteur et restent repérables d'un coup d'œil en base.
   */
  private static readonly IP_HASH_MARKER = 'outil-interne:studio:render-samples'

  /** Estimation prudente utilisée pour la réserve de coût, alignée sur le contrôleur. */
  private static readonly EST_JOB_COST_EUR = 0.5
  private static readonly DEFAULT_DAILY_COST_CAP_EUR = 30

  @args.string({ description: 'GID du produit porteur de la recette' })
  public productId: string

  @args.string({ description: 'Identifiant de la variante (format + finition)' })
  public variantId: string

  @flags.string({ description: 'Fichier JSON décrivant les créations à lancer' })
  public plan: string

  @flags.string({ description: 'Dossier contenant les photos citées par le plan' })
  public photos: string

  @flags.boolean({ description: 'Lancer réellement les générations (coûte de l’argent)' })
  public execute: boolean

  public async run() {
    const { default: RecipeService } = await import('App/Services/CustomArt/RecipeService')
    const { default: CustomArtVariantMapping } = await import(
      'App/Services/CustomArt/VariantMapping'
    )
    const { default: CustomArtStorage } = await import('App/Services/CustomArt/Storage')
    const { default: CustomArtJob } = await import('App/Models/CustomArtJob')
    const { default: CustomArtSession } = await import('App/Models/CustomArtSession')
    const Env = (await import('@ioc:Adonis/Core/Env')).default
    const sharp = (await import('sharp')).default

    if (!this.plan) {
      this.logger.error('--plan=<fichier.json> est requis.')
      return
    }

    // 1) Le plan
    let entries: { photo: string; fields: Record<string, unknown> }[]
    try {
      entries = JSON.parse(await fs.readFile(this.plan, 'utf8'))
      if (!Array.isArray(entries) || entries.length === 0) throw new Error('plan vide')
    } catch (error) {
      this.logger.error(`Plan illisible (${this.plan}) : ${(error as any)?.message || error}`)
      return
    }

    // 2) La variante donne format + finition, et doit désigner LE produit visé : une variante
    // d'un autre produit générerait avec la mauvaise recette sans que rien ne le signale.
    const mapped = await CustomArtVariantMapping.resolve(this.variantId)
    if (!mapped?.format || !mapped.frame) {
      this.logger.error(
        'Variante inconnue ou options non lisibles : impossible de déterminer format et finition.'
      )
      return
    }
    if (mapped.productId !== this.productId) {
      this.logger.error(
        `La variante appartient à ${mapped.productId || 'un produit inconnu'}, ` +
          `pas à ${this.productId}. Rien n'a été lancé.`
      )
      return
    }

    // 3) La recette du produit — exactement la lecture du chemin client.
    const loaded = await RecipeService.forProduct(this.productId)
    if (!loaded) {
      this.logger.error(
        'Ce produit ne porte pas de recette studio : rien à valider. (Poser la recette d’abord.)'
      )
      return
    }
    const { recipe } = loaded
    this.logger.info(
      `Recette lue : modèle ${recipe.model}, ${recipe.candidates} candidat(s) par création.`
    )

    // 4) Préparation de chaque création — TOUT est validé AVANT la moindre dépense : une coquille
    // sur la 6e ligne du plan ne doit pas être découverte après avoir payé les cinq premières.
    const prepared: { entry: (typeof entries)[number]; photo: Buffer; inputs: any }[] = []
    const problems: string[] = []

    for (const [index, entry] of entries.entries()) {
      const label = `#${index + 1} (${entry?.photo || 'sans photo'})`
      if (!entry || typeof entry !== 'object' || !entry.photo || !entry.fields) {
        problems.push(`${label} : entrée mal formée (il faut "photo" et "fields")`)
        continue
      }

      const path = this.photos ? join(this.photos, basename(entry.photo)) : entry.photo
      let normalized: Buffer
      try {
        const raw = await fs.readFile(path)
        const meta = await sharp(raw).metadata()
        const minSide = Math.min(meta.width || 0, meta.height || 0)
        if (minSide < 200) {
          problems.push(`${label} : photo trop petite (${minSide} px de côté, minimum 200)`)
          continue
        }
        normalized = await sharp(raw)
          .rotate()
          .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 90 })
          .toBuffer()
      } catch (error) {
        problems.push(`${label} : photo illisible (${(error as any)?.message || error})`)
        continue
      }

      const validated = RecipeService.validateGenericPayload(
        recipe,
        (name: string) => entry.fields[name]
      )
      if (!validated.ok) {
        problems.push(`${label} : ${validated.message}`)
        continue
      }

      prepared.push({ entry, photo: normalized, inputs: validated.inputs })
    }

    if (problems.length > 0) {
      this.logger.warning(`════ ENTRÉES ÉCARTÉES (${problems.length}) ════`)
      for (const p of problems) this.logger.warning(`  • ${p}`)
    }
    if (prepared.length === 0) {
      this.logger.error('Aucune création exploitable : rien à lancer.')
      return
    }

    // 5) Le plafond de COÛT du jour, lui, s'applique : c'est le garde-fou du portefeuille.
    const cap =
      Number(Env.get('CUSTOM_ART_DAILY_COST_CAP_EUR')) ||
      StudioRenderSamples.DEFAULT_DAILY_COST_CAP_EUR
    const since = DateTime.now().startOf('day').toSQL({ includeOffset: false }) as string
    const todayJobs = await CustomArtJob.query().where('created_at', '>=', since)
    const spent = todayJobs.reduce((sum, job) => {
      const known = job.costs?.totalEur || 0
      const inflight = ['pending', 'generating', 'judging'].includes(job.status)
      return sum + (inflight ? Math.max(known, StudioRenderSamples.EST_JOB_COST_EUR) : known)
    }, 0)
    const toSpend = prepared.length * StudioRenderSamples.EST_JOB_COST_EUR

    this.logger.info(
      `${prepared.length} création(s) prête(s). Dépense du jour : ${spent.toFixed(2)} € ` +
        `+ ~${toSpend.toFixed(2)} € = ~${(spent + toSpend).toFixed(2)} € (plafond ${cap} €).`
    )
    if (spent + toSpend > cap) {
      this.logger.error(
        'Le plafond de coût quotidien serait dépassé : rien n’a été lancé. ' +
          'Réduire le plan, ou relever CUSTOM_ART_DAILY_COST_CAP_EUR en connaissance de cause.'
      )
      return
    }

    if (!this.execute) {
      this.logger.info('')
      this.logger.info('🟡 SIMULATION — rien n’a été lancé. Ajouter --execute pour générer.')
      return
    }

    // 6) Une session par planche (pas une par création) : les créations restent groupées, comme
    // celles d'un même visiteur, ce qui permet de les retrouver ensemble.
    const session = await CustomArtSession.create({
      sessionToken: randomUUID(),
      ipHash: StudioRenderSamples.IP_HASH_MARKER,
      essaisCount: 0,
    })

    const launched: string[] = []
    for (const item of prepared) {
      const uuid = randomUUID()
      const photoPath = `custom-art/jobs/${uuid}/source.jpg`
      await CustomArtStorage.put(photoPath, item.photo, { isPublic: false })

      await CustomArtJob.create({
        uuid,
        sessionId: session.id,
        status: 'pending',
        photoPath,
        format: mapped.format!,
        frame: mapped.frame!,
        productType: 'poster',
        revealedCount: 0,
        round: 1,
        inputs: {
          productId: this.productId,
          tokens: item.inputs.tokens,
          values: item.inputs.values,
          title: item.inputs.title,
          tokensFrom: recipe.tokens?.from ?? null,
          ...(item.inputs.fields ? { fields: item.inputs.fields } : {}),
        },
      })

      session.essaisCount = session.essaisCount + 1
      launched.push(uuid)
      this.logger.success(`${uuid}  ${item.entry.photo}`)
    }
    await session.save()

    this.logger.info('')
    this.logger.info(`${launched.length} création(s) en file. Le worker les prend en charge.`)
    this.logger.info('Aperçus : /api/custom-art/jobs/<uuid>/preview/0')
  }
}
