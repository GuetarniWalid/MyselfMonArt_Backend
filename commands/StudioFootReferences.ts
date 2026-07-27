import { BaseCommand } from '@adonisjs/core/build/standalone'
import Authentication from 'App/Services/Shopify/Authentication'

/**
 * Retrouve dans Shopify Files les maillots migrés et imprime la liste d'identifiants prête à
 * coller dans le metafield `studio.references` (type list.file_reference).
 *
 * LECTURE SEULE. Complète `studio:migrate-foot-kits` : celle-ci téléverse, celle-ci retrouve.
 * Séparées à dessein — relancer la migration créerait des doublons, relancer cette lecture non.
 *
 *   node ace studio:foot-references
 */
export default class StudioFootReferences extends BaseCommand {
  public static commandName = 'studio:foot-references'
  public static description = 'Liste les identifiants Shopify des maillots foot (lecture seule)'
  public static settings = { loadApp: true, stayAlive: false }

  public async run() {
    const api = new (class extends Authentication {
      public async gql(query: string, variables: any) {
        return this.fetchGraphQL(query, variables)
      }
    })()

    // Les maillots migrés portent tous « -home-front » ou « -home-back » dans leur nom.
    const found: { name: string; id: string }[] = []
    let cursor: string | null = null

    for (let page = 0; page < 20; page++) {
      const res: any = await api.gql(
        `query files($cursor: String) {
          files(first: 250, after: $cursor, query: "media_type:IMAGE") {
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
        const name = (url.split('/').pop() || '').split('?')[0]
        if (/-home-(front|back)\./.test(name)) found.push({ name, id: node.id })
      }
      if (!conn.pageInfo?.hasNextPage) break
      cursor = conn.pageInfo.endCursor
    }

    found.sort((a, b) => a.name.localeCompare(b.name))

    // Un nom en double signifierait deux fichiers candidats pour une même référence : la recette
    // désignant PAR NOM, la résolution deviendrait ambiguë et le worker refuserait de générer.
    const seen = new Map<string, number>()
    for (const f of found) seen.set(f.name, (seen.get(f.name) || 0) + 1)
    const duplicates = [...seen.entries()].filter(([, n]) => n > 1)

    this.logger.info(`${found.length} maillot(s) trouvé(s) dans la médiathèque.`)
    if (duplicates.length > 0) {
      this.logger.error('════ DOUBLONS — à supprimer dans l’admin AVANT de poser la recette ════')
      for (const [name, n] of duplicates) this.logger.error(`  • ${name} présent ${n} fois`)
    }

    this.logger.info('')
    this.logger.info('════ studio.references (list.file_reference) ════')
    console.log(JSON.stringify(found.map((f) => f.id)))
    this.logger.info('')
    this.logger.info('════ correspondance nom → identifiant ════')
    for (const f of found) console.log(`  ${f.name}  ${f.id}`)
  }
}
