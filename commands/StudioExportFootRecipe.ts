import { BaseCommand, flags } from '@adonisjs/core/build/standalone'
import CustomArtTeam from 'App/Models/CustomArtTeam'
import { kitView } from 'App/Services/CustomArt/kits'

/**
 * Prépare la migration du poster foot vers le studio piloté par recette
 * (extension-Midjourney/PLAN-UNIFICATION-STUDIO-FOOT.md, lot P7).
 *
 * Les données d'équipe (maillots + consignes de fidélité) vivent aujourd'hui dans la table
 * `custom_art_teams`. La cible est de tout ranger dans les metafields de la fiche produit. Cette
 * commande fait le pont : elle LIT la base et IMPRIME (1) le champ de choix prêt à coller dans
 * `studio.recipe`, et (2) la liste des images à téléverser dans Shopify Files, avec le nom
 * canonique que la recette attendra.
 *
 * LECTURE SEULE — elle n'écrit ni en base, ni sur Shopify. Le téléversement des images et la pose
 * du metafield restent des gestes explicites du propriétaire.
 *
 * Elle SIGNALE ce qu'elle ne peut pas décider seule plutôt que de deviner :
 *  - une équipe sans image de maillot (inutilisable en génération) ;
 *  - une image dont le rôle FACE/DOS n'est pas déductible du nom de fichier ;
 *  - une équipe qui a plus d'images que le worker n'en envoie réellement.
 *
 *   node ace studio:export-foot-recipe
 *   node ace studio:export-foot-recipe --all   (inclut les équipes désactivées)
 */
export default class StudioExportFootRecipe extends BaseCommand {
  public static commandName = 'studio:export-foot-recipe'
  public static description =
    'Prépare la recette foot : options d’équipe + images à migrer (lecture seule)'
  public static settings = { loadApp: true, stayAlive: false }

  /** Le worker n'envoie que les 2 premières références maillot (JudgeService en montre 2 au juge). */
  private static readonly REFS_PER_TEAM = 2

  @flags.boolean({ description: 'Inclure aussi les équipes désactivées' })
  public all: boolean

  public async run() {
    const includeInactive = this.all === true

    const query = CustomArtTeam.query().orderBy('name', 'asc')
    if (!includeInactive) query.where('active', true)
    const teams = await query

    if (teams.length === 0) {
      this.logger.error('Aucune équipe trouvée. La base est-elle bien celle de production ?')
      return
    }

    const options: any[] = []
    const toMigrate: { team: string; from: string; to: string }[] = []
    const warnings: string[] = []

    for (const team of teams) {
      const urls: string[] = Array.isArray(team.kitRefUrls) ? team.kitRefUrls : []

      if (urls.length === 0) {
        warnings.push(
          `${team.name} (${team.slug}) : AUCUNE image de maillot — l'équipe ne peut pas générer`
        )
        continue
      }
      if (urls.length > StudioExportFootRecipe.REFS_PER_TEAM) {
        warnings.push(
          `${team.name} : ${urls.length} images, mais seules les ` +
            `${StudioExportFootRecipe.REFS_PER_TEAM} premières sont réellement envoyées — ` +
            `les suivantes sont ignorées ici aussi`
        )
      }

      const references: { name: string; role: string }[] = []
      for (const url of urls.slice(0, StudioExportFootRecipe.REFS_PER_TEAM)) {
        const role = kitView(url)
        if (!role) {
          warnings.push(
            `${team.name} : rôle indéterminable pour « ${url.split('/').pop()} » ` +
              `(ni -front ni -back) — à trancher À LA MAIN avant de coller la recette`
          )
        }
        // Nom CANONIQUE attendu par la recette après téléversement dans Shopify Files. La recette
        // désigne les images par NOM : ce nom doit donc être celui du fichier téléversé.
        const canonical = `kit-${team.slug}-${role || 'A-DECIDER'}.jpg`
        references.push({ name: canonical, role: role || 'A-DECIDER' })
        toMigrate.push({ team: team.name, from: url, to: canonical })
      }

      options.push({
        key: team.slug,
        label: team.name,
        ...(team.fidelityNotes ? { notes: team.fidelityNotes } : {}),
        references,
      })
    }

    // ---- 1. Le champ de choix, prêt à coller dans studio.recipe -----------------------------
    this.logger.info('')
    this.logger.info('════ 1. CHAMP DE CHOIX (à placer dans studio.recipe → inputs.fields) ════')
    console.log(
      JSON.stringify(
        {
          name: 'teamSlug',
          type: 'choice',
          required: true,
          options,
        },
        null,
        2
      )
    )

    // ---- 2. Les images à téléverser ---------------------------------------------------------
    this.logger.info('')
    this.logger.info(`════ 2. IMAGES À TÉLÉVERSER DANS SHOPIFY FILES (${toMigrate.length}) ════`)
    this.logger.info(
      'Téléverser chaque image SOUS LE NOM indiqué : la recette la désigne par ce nom.'
    )
    for (const m of toMigrate) {
      console.log(`  ${m.to}\n      ← ${m.from}`)
    }

    // ---- 3. Ce qui demande une décision humaine ---------------------------------------------
    this.logger.info('')
    if (warnings.length === 0) {
      this.logger.success('Aucun point à trancher : toutes les équipes sont exploitables.')
    } else {
      this.logger.warning(`════ 3. À TRANCHER AVANT DE COLLER (${warnings.length}) ════`)
      for (const w of warnings) this.logger.warning(`  • ${w}`)
    }

    this.logger.info('')
    this.logger.info(
      `${options.length} équipe(s) exploitable(s) sur ${teams.length} lue(s)` +
        `${includeInactive ? ' (désactivées incluses)' : ' (actives seulement)'}.`
    )
    this.logger.info(
      'RAPPEL : cette commande ne modifie RIEN. Téléversement des images et pose du metafield ' +
        'restent des gestes explicites.'
    )
  }
}
