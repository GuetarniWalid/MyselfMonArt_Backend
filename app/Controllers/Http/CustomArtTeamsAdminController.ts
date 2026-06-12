import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Logger from '@ioc:Adonis/Core/Logger'
import { promises as fs } from 'fs'
import sharp from 'sharp'
import CustomArtTeam from 'App/Models/CustomArtTeam'
import CustomArtTeamValidator from 'App/Validators/CustomArtTeamValidator'
import CustomArtStorage from 'App/Services/CustomArt/Storage'

// Maximum d'images de maillot par équipe (plan §4 : 1-2 réfs de génération, 3 = marge)
const MAX_KIT_IMAGES = 3

// Contraintes upload maillot : mêmes formats que la photo client, 10 Mo max
const KIT_EXTNAMES = ['jpg', 'jpeg', 'png', 'webp']
const KIT_MAX_SIZE = '10mb'
// Les réfs sont envoyées aux providers : 1600 px suffisent (détails blason/sponsor lisibles)
const KIT_MAX_PX = 1600

/**
 * CRUD admin de la bibliothèque d'équipes (M4) — routes /admin/custom-art/teams (auth).
 * Les images de maillot (kit_ref_urls) sont stockées PUBLIQUES sur DO Spaces
 * (custom-art/teams/...) : le worker les télécharge par URL (Worker.loadInputs)
 * et Replicate exige des URLs publiques.
 */
export default class CustomArtTeamsAdminController {
  /** GET /admin/custom-art/teams — toutes les équipes (actives ET inactives). */
  public async index({ response }: HttpContextContract) {
    response.header('Cache-Control', 'no-store')
    const teams = await CustomArtTeam.query().orderBy('name', 'asc')
    return { success: true, data: teams.map((t) => this.serialize(t)) }
  }

  /** POST /admin/custom-art/teams — création. */
  public async store({ request, response }: HttpContextContract) {
    try {
      const payload = await request.validate(CustomArtTeamValidator)

      const existing = await CustomArtTeam.findBy('slug', payload.slug)
      if (existing) {
        return response
          .status(422)
          .json({ success: false, message: `Le slug "${payload.slug}" est déjà utilisé.` })
      }

      const team = await CustomArtTeam.create({
        name: payload.name,
        slug: payload.slug,
        aliases: payload.aliases ?? [],
        colors: this.cleanColors(payload.colors),
        fidelityNotes: this.cleanNotes(payload.fidelityNotes),
        kitRefUrls: [],
        active: payload.active ?? true,
      })

      Logger.info('custom-art team CREATE id=%s slug=%s', team.id, team.slug)
      return { success: true, data: this.serialize(team) }
    } catch (error) {
      return this.handleError(error, response, 'création équipe')
    }
  }

  /** PUT /admin/custom-art/teams/:id — édition (nom, slug, aliases, couleurs, actif). */
  public async update({ params, request, response }: HttpContextContract) {
    try {
      const team = await this.findTeam(params.id)
      if (!team) {
        return response.status(404).json({ success: false, message: 'Équipe introuvable.' })
      }

      const payload = await request.validate(CustomArtTeamValidator)

      const conflict = await CustomArtTeam.query()
        .where('slug', payload.slug)
        .whereNot('id', team.id)
        .first()
      if (conflict) {
        return response
          .status(422)
          .json({ success: false, message: `Le slug "${payload.slug}" est déjà utilisé.` })
      }

      team.name = payload.name
      team.slug = payload.slug
      team.aliases = payload.aliases ?? []
      team.colors = this.cleanColors(payload.colors)
      team.fidelityNotes = this.cleanNotes(payload.fidelityNotes)
      if (payload.active !== undefined) team.active = payload.active
      await team.save()

      Logger.info('custom-art team UPDATE id=%s slug=%s', team.id, team.slug)
      return { success: true, data: this.serialize(team) }
    } catch (error) {
      return this.handleError(error, response, 'édition équipe')
    }
  }

  /** POST /admin/custom-art/teams/:id/toggle-active — activer/désactiver dans le studio. */
  public async toggleActive({ params, response }: HttpContextContract) {
    const team = await this.findTeam(params.id)
    if (!team) {
      return response.status(404).json({ success: false, message: 'Équipe introuvable.' })
    }
    team.active = !team.active
    await team.save()
    Logger.info('custom-art team TOGGLE id=%s active=%s', team.id, team.active)
    return { success: true, data: this.serialize(team) }
  }

  /**
   * POST /admin/custom-art/teams/:id/kit-images — upload multipart d'images de maillot
   * (champ "images", multiple). Normalisées en JPEG max 1600 px, stockées publiques sur
   * custom-art/teams/{slug}/, max 3 par équipe au total.
   */
  public async uploadKit({ params, request, response }: HttpContextContract) {
    const team = await this.findTeam(params.id)
    if (!team) {
      return response.status(404).json({ success: false, message: 'Équipe introuvable.' })
    }

    const files = request.files('images', { size: KIT_MAX_SIZE, extnames: KIT_EXTNAMES })
    if (files.length === 0) {
      return response
        .status(422)
        .json({ success: false, message: 'Aucune image reçue (champ "images").' })
    }

    const current = team.kitRefUrls || []
    if (current.length + files.length > MAX_KIT_IMAGES) {
      return response.status(422).json({
        success: false,
        message: `Maximum ${MAX_KIT_IMAGES} images de maillot par équipe (${current.length} déjà en place). Supprime-en d'abord.`,
      })
    }

    const added: string[] = []
    for (const file of files) {
      if (!file.isValid) {
        return response.status(422).json({
          success: false,
          message: `Image "${file.clientName}" refusée : JPG, PNG ou WEBP, 10 Mo max.`,
        })
      }

      let normalized: Buffer
      try {
        normalized = await sharp(await fs.readFile(file.tmpPath!))
          .rotate() // applique l'orientation EXIF
          .resize(KIT_MAX_PX, KIT_MAX_PX, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 90, mozjpeg: true })
          .toBuffer()
      } catch {
        return response.status(422).json({
          success: false,
          message: `Impossible de lire l'image "${file.clientName}". Envoie un JPG ou PNG.`,
        })
      }

      const key = `custom-art/teams/${team.slug}/kit-${Date.now()}-${added.length + 1}.jpg`
      await CustomArtStorage.put(key, normalized, { contentType: 'image/jpeg', isPublic: true })
      added.push(CustomArtStorage.publicUrl(key))
    }

    team.kitRefUrls = [...current, ...added]
    await team.save()

    Logger.info(
      'custom-art team KIT id=%s +%s image(s) (total %s)',
      team.id,
      added.length,
      team.kitRefUrls.length
    )
    return { success: true, data: this.serialize(team) }
  }

  /**
   * POST /admin/custom-art/teams/:id/kit-images/delete — { url } : retire une image
   * de maillot de la liste (suppression storage best-effort).
   */
  public async deleteKit({ params, request, response }: HttpContextContract) {
    const team = await this.findTeam(params.id)
    if (!team) {
      return response.status(404).json({ success: false, message: 'Équipe introuvable.' })
    }

    const url = String(request.input('url') || '')
    const current = team.kitRefUrls || []
    if (!url || !current.includes(url)) {
      return response
        .status(422)
        .json({ success: false, message: 'Image inconnue pour cette équipe.' })
    }

    team.kitRefUrls = current.filter((u) => u !== url)
    await team.save()

    // Suppression du fichier best-effort : on retrouve la clé depuis l'URL publique
    const marker = 'custom-art/teams/'
    const idx = url.indexOf(marker)
    if (idx !== -1) {
      await CustomArtStorage.delete(url.slice(idx))
    }

    Logger.info('custom-art team KIT DELETE id=%s (reste %s)', team.id, team.kitRefUrls.length)
    return { success: true, data: this.serialize(team) }
  }

  // --------------------------------------------------------------------------
  // Helpers privés
  // --------------------------------------------------------------------------

  private async findTeam(id: unknown): Promise<CustomArtTeam | null> {
    const numeric = Number(id)
    if (!Number.isInteger(numeric) || numeric <= 0) return null
    return CustomArtTeam.find(numeric)
  }

  /** Notes de fidélité : trim + null si vide (textarea vidé depuis l'admin). */
  private cleanNotes(notes: string | null | undefined): string | null {
    const trimmed = (notes ?? '').trim()
    return trimmed.length > 0 ? trimmed : null
  }

  /** Ne garde que les couleurs renseignées (les pickers vides ne polluent pas le JSON). */
  private cleanColors(
    colors: { primary?: string; secondary?: string; accent?: string } | undefined
  ): Record<string, string> | null {
    if (!colors) return null
    const out: Record<string, string> = {}
    for (const key of ['primary', 'secondary', 'accent'] as const) {
      const value = colors[key]
      if (value) out[key] = value.toLowerCase()
    }
    return Object.keys(out).length > 0 ? out : null
  }

  private serialize(team: CustomArtTeam) {
    return {
      id: team.id,
      name: team.name,
      slug: team.slug,
      aliases: team.aliases || [],
      colors: team.colors || null,
      fidelityNotes: team.fidelityNotes || null,
      kitRefUrls: team.kitRefUrls || [],
      // MySQL renvoie 0/1 sur les booleans : on normalise pour le front
      active: Boolean(team.active),
      updatedAt: team.updatedAt?.toISO() || null,
    }
  }

  private handleError(error: any, response: HttpContextContract['response'], context: string) {
    if (error.code === 'E_VALIDATION_FAILURE') {
      return response.status(422).json({
        success: false,
        message: 'Validation failed',
        errors: error.messages,
      })
    }
    Logger.error('custom-art admin %s: %s', context, error?.message || error)
    return response.status(500).json({ success: false, message: 'Erreur serveur, réessaie.' })
  }
}
