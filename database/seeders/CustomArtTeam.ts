import BaseSeeder from '@ioc:Adonis/Lucid/Seeder'
import CustomArtTeam from 'App/Models/CustomArtTeam'

/**
 * Seed M4 : 15 équipes pertinentes pour le marché FR (poster personnalisé foot).
 * - colors = couleurs principales du maillot DOMICILE actuel (pastilles du studio).
 * - kitRefUrls = [] volontairement : les vraies photos de maillots sont uploadées
 *   depuis la page admin /custom-art-teams (sans elles, la génération refuse l'équipe).
 * - fidelityNotes (décision grill §0.13) = éléments iconiques du maillot domicile +
 *   pièges, injectées dans le prompt de génération et fournies au juge vision.
 *   Les règles dos communes (nom au-dessus du numéro, blason côté cœur de face
 *   uniquement, sponsor poitrine de face uniquement) sont portées par le prompt maître.
 * - Idempotent : fetchOrCreateMany sur le slug -> ne touche JAMAIS une équipe existante
 *   (les uploads de maillots déjà faits sont préservés au re-run). Seule exception :
 *   les fidelityNotes sont backfillées quand la colonne est encore NULL (colonne ajoutée
 *   après le seed initial) — une note éditée depuis l'admin n'est jamais écrasée.
 *
 * Lancer : node ace db:seed
 */
const TEAMS = [
  {
    name: 'Équipe de France',
    slug: 'equipe-de-france',
    aliases: ['france', 'les bleus', 'edf', 'fff'],
    colors: { primary: '#002654', secondary: '#ffffff' },
    fidelityNotes:
      'Maillot bleu nuit uni, col blanc. Coq FFF doré côté cœur surmonté de 2 étoiles dorées (pas une de plus), logo équipementier doré, nom et numéro du dos en typographie dorée. ' +
      'Pièges : pas de bandes tricolores envahissantes, ne pas réinventer le coq, ne pas éclaircir le bleu nuit. Pas de sponsor poitrine (sélection nationale).',
    kitRefUrls: [],
    active: true,
  },
  {
    name: 'Paris Saint-Germain',
    slug: 'psg',
    aliases: ['paris', 'paris saint-germain', 'paris sg'],
    colors: { primary: '#004170', secondary: '#da291c' },
    fidelityNotes:
      'Fond bleu marine avec la BANDE VERTICALE CENTRALE rouge bordée de blanc (bande Hechter). Sponsor QATAR AIRWAYS sur la poitrine, blason PSG (tour Eiffel blanche dans un cercle bleu, berceau rouge) côté cœur. ' +
      "Pièges : la bande doit rester parfaitement centrale et continue du col à l'ourlet — jamais déportée, dédoublée ni réduite à une fine rayure ; ne pas inverser le bleu et le rouge.",
    kitRefUrls: [],
    active: true,
  },
  {
    name: 'Olympique de Marseille',
    slug: 'om',
    aliases: ['marseille', 'olympique de marseille', 'l om'],
    colors: { primary: '#ffffff', secondary: '#009ddc' },
    fidelityNotes:
      'Maillot BLANC, accents bleu ciel (col, bords de manches), sponsor CMA CGM sur la poitrine, blason OM bleu ciel côté cœur. ' +
      "Pièges : le maillot reste majoritairement blanc — le bleu ciel n'est qu'un accent, ne pas produire un maillot bleu ; sponsor orthographié exactement CMA CGM.",
    kitRefUrls: [],
    active: true,
  },
  {
    name: 'Olympique Lyonnais',
    slug: 'ol',
    aliases: ['lyon', 'olympique lyonnais', 'les gones'],
    colors: { primary: '#ffffff', secondary: '#da001d' },
    fidelityNotes:
      'Maillot BLANC, accents rouge et bleu (les deux couleurs historiques du club, souvent en bandes), blason OL avec le lion côté cœur. ' +
      'Pièges : le fond reste blanc — rouge et bleu ne sont que des accents ; reproduire le sponsor poitrine exactement tel que sur les images de référence.',
    kitRefUrls: [],
    active: true,
  },
  {
    name: 'AS Monaco',
    slug: 'as-monaco',
    aliases: ['monaco', 'asm'],
    colors: { primary: '#e51b22', secondary: '#ffffff' },
    fidelityNotes:
      'Maillot iconique à DIAGONALE rouge et blanche : torse partagé en deux par une diagonale, rouge en haut et blanc en bas, blason ASM côté cœur. ' +
      'Pièges : respecter le sens et la netteté de la diagonale — pas de rayures ni de moitiés verticales ; reproduire le sponsor poitrine exactement tel que sur les références.',
    kitRefUrls: [],
    active: true,
  },
  {
    name: 'RC Lens',
    slug: 'rc-lens',
    aliases: ['lens', 'rcl', 'sang et or'],
    colors: { primary: '#e2002b', secondary: '#fcd116' },
    fidelityNotes:
      'Maillot « sang et or » : rouge sang et jaune or, les deux couleurs fortement présentes (souvent en larges pans ou rayures selon la saison — suivre les images de référence), blason RC Lens côté cœur. ' +
      'Pièges : ne pas remplacer le jaune or par du blanc ; suivre exactement la découpe rouge/or des références ; sponsor poitrine reproduit tel quel.',
    kitRefUrls: [],
    active: true,
  },
  {
    name: 'LOSC Lille',
    slug: 'losc',
    aliases: ['lille', 'losc lille', 'les dogues'],
    colors: { primary: '#e01e13', secondary: '#1e2c5c' },
    fidelityNotes:
      'Maillot ROUGE dominant, accents bleu marine, blason LOSC avec le dogue côté cœur. ' +
      'Pièges : ne pas virer au bordeaux ni au orange ; suivre exactement le placement des accents bleu marine des références ; sponsor poitrine reproduit tel quel.',
    kitRefUrls: [],
    active: true,
  },
  {
    name: 'FC Barcelone',
    slug: 'fc-barcelone',
    aliases: ['barca', 'barcelone', 'fcb', 'barcelona'],
    colors: { primary: '#004d98', secondary: '#a50044' },
    fidelityNotes:
      'Rayures VERTICALES blaugrana (bleu roi et grenat), sponsor Spotify sur la poitrine, blason du FC Barcelone côté cœur. ' +
      'Pièges : les rayures sont verticales et régulières — jamais horizontales ni diagonales ; ne pas fusionner les deux couleurs en violet uni ; respecter le rendu exact des références.',
    kitRefUrls: [],
    active: true,
  },
  {
    name: 'Real Madrid',
    slug: 'real-madrid',
    aliases: ['real', 'madrid', 'merengues'],
    colors: { primary: '#ffffff', secondary: '#00529f' },
    fidelityNotes:
      'Maillot BLANC, liseré et accents dorés, sponsor Emirates sur la poitrine, blason couronné du Real Madrid côté cœur. ' +
      'Pièges : le fond reste strictement blanc (ni gris ni crème), les accents dorés sont discrets ; reproduire le lettrage exact du sponsor des références.',
    kitRefUrls: [],
    active: true,
  },
  {
    name: 'Bayern Munich',
    slug: 'bayern-munich',
    aliases: ['bayern', 'fc bayern', 'munich'],
    colors: { primary: '#dc052d', secondary: '#ffffff' },
    fidelityNotes:
      'Maillot ROUGE dominant, accents blancs, blason rond FC Bayern München (losanges bleus et blancs au centre) côté cœur, sponsor Telekom (« T ») sur la poitrine. ' +
      'Pièges : rester sur le rouge Bayern franc (pas de bordeaux) ; suivre exactement le motif et les accents des images de référence.',
    kitRefUrls: [],
    active: true,
  },
  {
    name: 'Liverpool FC',
    slug: 'liverpool',
    aliases: ['liverpool fc', 'lfc', 'les reds'],
    colors: { primary: '#c8102e', secondary: '#ffffff' },
    fidelityNotes:
      'Maillot entièrement ROUGE (cols et accents selon la saison — suivre les références), blason avec le liver bird côté cœur, sponsor Standard Chartered sur la poitrine. ' +
      'Pièges : un rouge profond uniforme, pas d’orange ni de bordeaux ; ne pas inventer de rayures ; reproduire le sponsor tel quel.',
    kitRefUrls: [],
    active: true,
  },
  {
    name: 'Manchester City',
    slug: 'manchester-city',
    aliases: ['man city', 'city', 'mancity'],
    colors: { primary: '#6cabdd', secondary: '#1c2c5b' },
    fidelityNotes:
      'Maillot BLEU CIEL caractéristique, accents blancs ou bleu marine, blason rond Manchester City (voilier et rose rouge) côté cœur, sponsor Etihad Airways sur la poitrine. ' +
      'Pièges : le bleu ciel City est clair et doux — ne pas le foncer vers le bleu roi ; reproduire le sponsor et le blason exactement comme sur les références.',
    kitRefUrls: [],
    active: true,
  },
  {
    name: 'Juventus',
    slug: 'juventus',
    aliases: ['juve', 'juventus turin'],
    colors: { primary: '#000000', secondary: '#ffffff' },
    fidelityNotes:
      'Rayures VERTICALES noires et blanches (bianconeri), blason « J » stylisé côté cœur. ' +
      'Pièges : les rayures sont verticales et nettes — jamais horizontales ; pas de gris : du noir et du blanc francs ; reproduire le sponsor poitrine exactement tel que sur les images de référence.',
    kitRefUrls: [],
    active: true,
  },
  {
    name: 'Brésil',
    slug: 'bresil',
    aliases: ['brazil', 'selecao', 'la seleção'],
    colors: { primary: '#ffdc02', secondary: '#009739' },
    fidelityNotes:
      'Maillot JAUNE canari, col et bords de manches verts, blason CBF côté cœur. ' +
      'Pièges : le jaune reste vif (pas de moutarde ni d’or), le vert n’apparaît qu’en accents ; pas de sponsor poitrine (sélection nationale).',
    kitRefUrls: [],
    active: true,
  },
  {
    name: 'Argentine',
    slug: 'argentine',
    aliases: ['argentina', 'albiceleste'],
    colors: { primary: '#75aadb', secondary: '#ffffff' },
    fidelityNotes:
      'Rayures VERTICALES bleu ciel et blanches (albiceleste), blason AFA côté cœur surmonté de 3 étoiles dorées. ' +
      'Pièges : les rayures sont verticales et larges — pas de bleu uni ; le bleu ciel argentin est clair ; pas de sponsor poitrine (sélection nationale).',
    kitRefUrls: [],
    active: true,
  },
]

export default class extends BaseSeeder {
  public async run() {
    await CustomArtTeam.fetchOrCreateMany('slug', TEAMS)

    // Backfill des notes de fidélité (colonne ajoutée après le seed initial) :
    // uniquement les équipes dont la note est encore NULL — une note éditée depuis
    // l'admin n'est jamais écrasée (une note vidée sera re-renseignée au prochain seed).
    for (const team of TEAMS) {
      await CustomArtTeam.query()
        .where('slug', team.slug)
        .whereNull('fidelity_notes')
        .update({ fidelity_notes: team.fidelityNotes })
    }
  }
}
