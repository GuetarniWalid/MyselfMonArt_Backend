import { BaseCommand, args, flags } from '@adonisjs/core/build/standalone'
import CustomArtTeam from 'App/Models/CustomArtTeam'
import Authentication from 'App/Services/Shopify/Authentication'
import { kitView } from 'App/Services/CustomArt/kits'
import { buildFootRecipe, FootTeamOption } from 'App/Services/CustomArt/footRecipe'

/**
 * Pose la recette studio du poster foot sur un produit : `studio.recipe` (la recette) et
 * `studio.references` (les maillots déjà migrés dans Shopify Files).
 *
 * ⚠️ POSER LA RECETTE SUR LE PRODUIT FOOT RÉEL, C'EST LA BASCULE : dès la minute suivante (cache
 * 5 min), les commandes de vrais clients emprunteraient le chemin piloté par recette. Cette
 * commande est faite pour être utilisée D'ABORD sur un produit de TEST en brouillon.
 *
 * Simulation par défaut ; `--execute` est nécessaire pour écrire.
 *
 *   node ace studio:post-foot-recipe gid://shopify/Product/123
 *   node ace studio:post-foot-recipe gid://shopify/Product/123 --execute
 */
export default class StudioPostFootRecipe extends BaseCommand {
  public static commandName = 'studio:post-foot-recipe'
  public static description =
    'Pose studio.recipe + studio.references sur un produit (simulation par défaut)'
  public static settings = { loadApp: true, stayAlive: false }

  private static readonly REFS_PER_TEAM = 2

  @args.string({ description: 'GID du produit cible (gid://shopify/Product/...)' })
  public productId: string

  @flags.boolean({ description: 'Écrire réellement les metafields' })
  public execute: boolean

  public async run() {
    const dry = !this.execute
    if (!/^gid:\/\/shopify\/Product\/\d+$/.test(this.productId || '')) {
      this.logger.error('Identifiant produit attendu au format gid://shopify/Product/<nombre>')
      return
    }

    const api = new (class extends Authentication {
      public async gql(query: string, variables: any) {
        return this.fetchGraphQL(query, variables)
      }
    })()

    // 1) Les maillots déjà présents dans la médiathèque, par nom de fichier.
    const filesByName = await this.loadKitFiles(api)
    this.logger.info(`${filesByName.size} maillot(s) trouvé(s) dans la médiathèque.`)

    // 2) Les équipes, avec leurs consignes de fidélité.
    const teams = await CustomArtTeam.query().where('active', true).orderBy('name', 'asc')
    const options: FootTeamOption[] = []
    const referenceIds: string[] = []
    const problems: string[] = []

    for (const team of teams) {
      const urls: string[] = Array.isArray(team.kitRefUrls) ? team.kitRefUrls : []
      const references: { name: string; role: string }[] = []

      for (const url of urls.slice(0, StudioPostFootRecipe.REFS_PER_TEAM)) {
        const role = kitView(url)
        const name = (url.split('/').pop() || '').split('?')[0]
        if (!role) {
          problems.push(`${team.name} : rôle indéterminable pour ${name}`)
          continue
        }
        const fileId = filesByName.get(name.toLowerCase())
        if (!fileId) {
          // La recette désigne PAR NOM : un maillot absent de la médiathèque rendrait la
          // génération impossible. Mieux vaut le voir ici qu'au premier client.
          problems.push(`${team.name} : « ${name} » absent de Shopify Files (migration faite ?)`)
          continue
        }
        references.push({ name, role })
        if (!referenceIds.includes(fileId)) referenceIds.push(fileId)
      }

      if (references.length === 0) {
        problems.push(`${team.name} : aucun maillot exploitable — équipe ÉCARTÉE de la recette`)
        continue
      }
      options.push({
        key: team.slug,
        label: team.name,
        ...(team.fidelityNotes ? { notes: team.fidelityNotes } : {}),
        references,
      })
    }

    if (problems.length > 0) {
      this.logger.warning(`════ POINTS À RÉGLER (${problems.length}) ════`)
      for (const p of problems) this.logger.warning(`  • ${p}`)
    }
    if (options.length === 0) {
      this.logger.error('Aucune équipe exploitable : rien à poser.')
      return
    }

    const recipe = buildFootRecipe(options)
    this.logger.info(
      `Recette : ${options.length} équipe(s), ${referenceIds.length} image(s), ` +
        `prompt de ${recipe.prompt.base.length} caractères.`
    )

    if (dry) {
      this.logger.info('')
      this.logger.info('🟡 SIMULATION — rien n’a été écrit. Ajouter --execute pour poser.')
      this.logger.info(`Cible : ${this.productId}`)
      return
    }

    // 3) Écriture. `studio.references` D'ABORD : une recette qui désigne des images encore
    // absentes ferait échouer les générations pendant l'intervalle entre les deux écritures.
    await this.setMetafield(api, 'references', 'list.file_reference', JSON.stringify(referenceIds))
    this.logger.success(`studio.references posé (${referenceIds.length} images)`)
    await this.setMetafield(api, 'recipe', 'json', JSON.stringify(recipe))
    this.logger.success('studio.recipe posé')

    this.logger.info('')
    this.logger.warning(
      'Le routage bascule au prochain rafraîchissement du cache recette (5 min max).'
    )
  }

  private async loadKitFiles(api: any): Promise<Map<string, string>> {
    const byName = new Map<string, string>()
    let cursor: string | null = null
    for (let page = 0; page < 20; page++) {
      const res: any = await api.gql(
        `query files($cursor: String) {
          files(first: 250, after: $cursor, sortKey: CREATED_AT, reverse: true) {
            pageInfo { hasNextPage endCursor }
            nodes { ... on MediaImage { id image { url } } }
          }
        }`,
        { cursor }
      )
      const conn = res?.files
      if (!conn) break
      for (const node of conn.nodes || []) {
        const url: string = node?.image?.url || ''
        if (!url) continue
        const name = (url.split('/').pop() || '').split('?')[0].toLowerCase()
        if (/-home-(front|back)\./.test(name) && !byName.has(name)) byName.set(name, node.id)
      }
      if (!conn.pageInfo?.hasNextPage) break
      cursor = conn.pageInfo.endCursor
    }
    return byName
  }

  private async setMetafield(api: any, key: string, type: string, value: string) {
    const res = await api.gql(
      `mutation setMf($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields { key }
          userErrors { field message }
        }
      }`,
      {
        metafields: [{ ownerId: this.productId, namespace: 'studio', key, type, value }],
      }
    )
    const errors = res?.metafieldsSet?.userErrors || []
    if (errors.length > 0) throw new Error(`studio.${key} : ${errors[0].message}`)
  }
}
