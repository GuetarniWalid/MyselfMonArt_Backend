import { BaseCommand, flags } from '@adonisjs/core/build/standalone'
import CustomArtTeam from 'App/Models/CustomArtTeam'
import Authentication from 'App/Services/Shopify/Authentication'
import { kitView } from 'App/Services/CustomArt/kits'

/**
 * Migre les maillots du poster foot depuis DigitalOcean Spaces vers Shopify Files
 * (extension-Midjourney/PLAN-UNIFICATION-STUDIO-FOOT.md, lot P7).
 *
 * POURQUOI RELIRE LES NOMS APRÈS COUP
 * La recette désigne ses images PAR NOM de fichier. Or c'est Shopify qui décide du nom final : il
 * le dérive de l'URL source et le SUFFIXE si un fichier du même nom existe déjà. Parier sur le nom
 * qu'on croit avoir donné, c'est risquer une recette qui pointe dans le vide. Cette commande
 * téléverse, puis RELIT l'URL réellement attribuée, et imprime le champ de choix construit à partir
 * de ces noms-là.
 *
 * SÉCURITÉ : simulation par défaut. `--execute` est nécessaire pour écrire quoi que ce soit, et
 * l'écriture reste ADDITIVE (de nouveaux fichiers dans la médiathèque) — aucun produit, aucun
 * metafield, aucune commande n'est touché. Un fichier de trop se supprime dans l'admin.
 *
 *   node ace studio:migrate-foot-kits              (simulation)
 *   node ace studio:migrate-foot-kits --execute    (téléverse réellement)
 */
export default class StudioMigrateFootKits extends BaseCommand {
  public static commandName = 'studio:migrate-foot-kits'
  public static description =
    'Téléverse les maillots foot dans Shopify Files (simulation par défaut)'
  public static settings = { loadApp: true, stayAlive: false }

  /** Le worker n'envoie que les 2 premières références maillot. */
  private static readonly REFS_PER_TEAM = 2

  @flags.boolean({ description: 'Téléverser réellement (sinon simulation)' })
  public execute: boolean

  public async run() {
    const dry = !this.execute
    this.logger.info(
      dry
        ? '🟡 SIMULATION — rien ne sera écrit. Ajouter --execute pour téléverser.'
        : '🔴 TÉLÉVERSEMENT RÉEL dans Shopify Files (additif : aucun produit touché).'
    )

    const teams = await CustomArtTeam.query().where('active', true).orderBy('name', 'asc')
    const api = new (class extends Authentication {
      public async gql(query: string, variables: any) {
        return this.fetchGraphQL(query, variables)
      }
    })()

    const options: any[] = []
    const failures: string[] = []

    for (const team of teams) {
      const urls: string[] = Array.isArray(team.kitRefUrls) ? team.kitRefUrls : []
      if (urls.length === 0) {
        failures.push(`${team.name} : aucune image de maillot`)
        continue
      }

      const references: { name: string; role: string }[] = []
      for (const url of urls.slice(0, StudioMigrateFootKits.REFS_PER_TEAM)) {
        const role = kitView(url)
        if (!role) {
          failures.push(`${team.name} : rôle indéterminable pour ${url.split('/').pop()}`)
          continue
        }

        if (dry) {
          // En simulation, on annonce le nom PROBABLE (celui de la source) sans rien écrire.
          references.push({ name: (url.split('/').pop() || '').split('?')[0], role })
          continue
        }

        try {
          const finalName = await this.uploadAndReadName(api, url, `Maillot ${team.name} (${role})`)
          references.push({ name: finalName, role })
          this.logger.success(`${team.name} ${role} → ${finalName}`)
        } catch (error) {
          failures.push(`${team.name} ${role} : ${(error as any)?.message || error}`)
        }
      }

      if (references.length > 0) {
        options.push({
          key: team.slug,
          label: team.name,
          ...(team.fidelityNotes ? { notes: team.fidelityNotes } : {}),
          references,
        })
      }
    }

    this.logger.info('')
    this.logger.info('════ CHAMP DE CHOIX (noms RÉELS après téléversement) ════')
    console.log(
      JSON.stringify({ name: 'teamSlug', type: 'choice', required: true, options }, null, 2)
    )

    this.logger.info('')
    if (failures.length === 0) {
      this.logger.success(`${options.length} équipe(s) prête(s), aucune anomalie.`)
    } else {
      this.logger.warning(`════ ANOMALIES (${failures.length}) ════`)
      for (const f of failures) this.logger.warning(`  • ${f}`)
    }
    if (dry) {
      this.logger.info('')
      this.logger.info('Simulation : relancer avec --execute pour téléverser réellement.')
    }
  }

  /**
   * Crée le fichier depuis son URL publique, attend qu'il soit prêt, puis renvoie le nom de
   * fichier RÉELLEMENT attribué par Shopify (qui peut différer de celui de la source).
   */
  private async uploadAndReadName(api: any, sourceUrl: string, alt: string): Promise<string> {
    const created = await api.gql(
      `mutation fileCreate($files: [FileCreateInput!]!) {
        fileCreate(files: $files) {
          files { ... on MediaImage { id } }
          userErrors { field message }
        }
      }`,
      { files: [{ alt, contentType: 'IMAGE', originalSource: sourceUrl }] }
    )
    if (created.fileCreate.userErrors?.length) {
      throw new Error(created.fileCreate.userErrors[0].message)
    }
    const fileId = created.fileCreate.files[0].id

    // Le fichier est traité de façon asynchrone : son URL n'existe qu'une fois prêt.
    for (let attempt = 1; attempt <= 20; attempt++) {
      const read = await api.gql(
        `query fileStatus($id: ID!) {
          node(id: $id) { ... on MediaImage { fileStatus image { url } } }
        }`,
        { id: fileId }
      )
      const node = read?.node
      if (node?.fileStatus === 'READY' && node?.image?.url) {
        const name = (node.image.url.split('/').pop() || '').split('?')[0]
        if (!name) throw new Error('URL sans nom de fichier exploitable')
        return name
      }
      if (node?.fileStatus === 'FAILED') throw new Error('Shopify a rejeté le fichier')
      await new Promise((r) => setTimeout(r, 2000))
    }
    throw new Error('fichier toujours pas prêt après 40 s')
  }
}
