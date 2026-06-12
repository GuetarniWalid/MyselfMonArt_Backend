import { BaseCommand, flags } from '@adonisjs/core/build/standalone'
import { promises as fs } from 'fs'
import { join } from 'path'

/**
 * Seed des images de maillot de référence (M5) : pousse les réfs CALIBRÉES
 * (scripts/bench/kits/<slug>-home-{back,front}.jpg — photo produit boutique/équipementier,
 * sans personne, exigé par le filtre Gemini 3.x) via le Storage CustomArt
 * (custom-art/teams/<slug>/) et met à jour kit_ref_urls (+ notes de fidélité calibrées)
 * des 15 équipes de la bibliothèque (5 du bench M1 + 10 complétées le 2026-06-12).
 *
 * L'ordre [dos, front] et les suffixes -back/-front sont CONSERVÉS dans les clés :
 * le prompt maître et le juge annoncent la vue FACE/DOS d'après le suffixe du fichier.
 *
 * Lancer : node ace custom_art:seed_kits [--force]
 *   --force : remplace des kit_ref_urls déjà renseignées (sinon équipe sautée)
 *
 * ⚠ À REJOUER EN PROD après chaque déploiement qui ajoute/modifie des réfs :
 * la DB locale et la DB prod sont distinctes (le Storage Spaces est partagé).
 * Sur le serveur : node ace custom_art:seed_kits (idempotent, --force pour remplacer).
 */

// slug bench -> slug DB (seed M4) + notes de fidélité CALIBRÉES sur ces images exactes
// (sources : scripts/bench/kits/sources.md — ex : France 2026 = motif diagonal, pas bleu nuit uni)
const BENCH_TEAMS: Array<{ bench: string; db: string; fidelityNotes: string }> = [
  {
    bench: 'france',
    db: 'equipe-de-france',
    fidelityNotes:
      "Maillot bleu roi (Game Royal) couvert d'un MOTIF GRAPHIQUE DIAGONAL ton sur ton (fines rayures bleu foncé/bleu vif sur tout le maillot, comme sur les références), col polo blanc. Coq FFF doré/cuivré porté côté cœur, surmonté de 2 étoiles dorées (pas une de plus), logo équipementier doré. Nom et numéro du dos en typographie BLANCHE à ombre portée dorée/cuivrée. Pièges : le maillot n'est PAS uni ni bleu nuit — reproduire le motif diagonal des références ; pas de bandes tricolores envahissantes ; ne pas réinventer le coq. Pas de sponsor poitrine (sélection nationale).",
  },
  {
    bench: 'psg',
    db: 'psg',
    fidelityNotes:
      "Fond bleu marine avec la BANDE VERTICALE CENTRALE rouge bordée de blanc (bande Hechter), motif géométrique discret dans la bande. Sponsor QATAR AIRWAYS sur la poitrine, blason PSG (tour Eiffel blanche dans un cercle bleu, berceau rouge) côté cœur. Pièges : la bande doit rester parfaitement CENTRALE et continue du col à l'ourlet — jamais déportée, dédoublée ni réduite à une fine rayure ; ne pas inverser le bleu et le rouge.",
  },
  {
    bench: 'om',
    db: 'om',
    fidelityNotes:
      "Maillot BLANC, accents bleu ciel (col, bords de manches), sponsor CMA CGM sur la poitrine, blason OM bleu ciel côté cœur. Pièges : le maillot reste majoritairement blanc — le bleu ciel n'est qu'un accent, ne pas produire un maillot bleu ; sponsor orthographié exactement CMA CGM.",
  },
  {
    bench: 'barcelone',
    db: 'fc-barcelone',
    fidelityNotes:
      'Rayures VERTICALES blaugrana (bleu roi et grenat), sponsor Spotify sur la poitrine, blason du FC Barcelone côté cœur. Pièges : les rayures sont verticales et régulières — jamais horizontales ni diagonales ; ne pas fusionner les deux couleurs en violet uni ; respecter le rendu exact des références (dégradé compris).',
  },
  {
    bench: 'real-madrid',
    db: 'real-madrid',
    fidelityNotes:
      'Maillot BLANC, liseré et accents dorés, sponsor Emirates sur la poitrine, blason couronné du Real Madrid côté cœur. Pièges : le fond reste strictement blanc (ni gris ni crème), les accents dorés sont discrets ; reproduire le lettrage exact du sponsor des références.',
  },
  {
    bench: 'ol',
    db: 'ol',
    fidelityNotes:
      "Maillot BLANC avec une BANDE VERTICALE CENTRALE bicolore du col à l'ourlet : moitié gauche rouge, moitié droite bleu roi. Blason OL (lion) au centre de la bande sous le logo équipementier, sponsor Emirates FLY BETTER en bleu sur la poitrine, fines bandes rouges aux épaules, liseré bleu. Pièges : la bande reste centrale et continue — ne pas la déporter ni inverser rouge et bleu ; le dos est blanc uni (sans bande).",
  },
  {
    bench: 'as-monaco',
    db: 'as-monaco',
    fidelityNotes:
      "Maillot iconique à DIAGONALE rouge et blanche : torse partagé par une diagonale, rouge en haut à droite et blanc en bas à gauche, col à liseré rouge, fins liserés dorés aux manches. Sponsor apm MONACO en blanc dans la partie rouge, blason ASM couronné côté cœur. Pièges : respecter le sens et la netteté de la diagonale — pas de rayures ni de moitiés verticales ; le dos est majoritairement BLANC (nom et numéro rouges) avec une bande rouge à l'ourlet.",
  },
  {
    bench: 'rc-lens',
    db: 'rc-lens',
    fidelityNotes:
      "Maillot « sang et or » : fond JAUNE or dominant parcouru de FINES RAYURES VERTICALES rouges (pinstripes), col V rouge, bouts de manches rouges. Sponsor Auchan (oiseau + lettrage rouge) sur la poitrine, blason RC Lens côté cœur. Pièges : le jaune domine — le rouge n'apparaît qu'en fines rayures et accents, pas en larges pans ; ne pas remplacer le jaune or par du blanc ; le haut du dos est jaune uni (sans rayures).",
  },
  {
    bench: 'losc',
    db: 'losc',
    fidelityNotes:
      "Maillot ROUGE couvert d'un MOTIF GÉOMÉTRIQUE ton sur ton (pentagones/crénelages en nuances de rouge inspirés de la Citadelle de Lille), fins liserés blanc et bleu marine au col et aux manches. Sponsor Boulanger en blanc sur la poitrine, blason LOSC avec le dogue côté cœur. Pièges : ne pas virer au bordeaux ni à l'orange ; le motif reste subtil (nuances de rouge, pas de couleurs étrangères) ; le haut du dos est rouge uni, le motif reprend en bas.",
  },
  {
    bench: 'bayern-munich',
    db: 'bayern-munich',
    fidelityNotes:
      'Maillot ROUGE et BLANC au graphisme audacieux : grand « M » stylisé formé par des transitions crénelées rouge/blanc sur le torse (blanc descendant des épaules, rouge au centre). Blason rond FC Bayern München (losanges bleus et blancs) surmonté de 5 ÉTOILES dorées, sponsor « T » (Deutsche Telekom) blanc au centre, 3 bandes blanches adidas aux épaules. Pièges : rester sur le rouge Bayern franc (pas de bordeaux) ; reproduire les transitions crénelées du motif — pas de simple dégradé ; le dos est rouge avec col et bouts de manches blancs.',
  },
  {
    bench: 'liverpool',
    db: 'liverpool',
    fidelityNotes:
      "Maillot entièrement ROUGE profond, col rond et liserés BLANCS, 3 bandes blanches adidas aux épaules. Liver bird blanc côté cœur au-dessus de « L.F.C. », sponsor Standard Chartered en blanc sur la poitrine. Pièges : un rouge profond uniforme — pas d'orange ni de bordeaux ; ne pas inventer de rayures ni de motifs ; reproduire le sponsor tel quel.",
  },
  {
    bench: 'manchester-city',
    db: 'manchester-city',
    fidelityNotes:
      "Maillot BLEU CIEL avec une ÉCHARPE DIAGONALE (sash) BLANCHE traversant le torse de l'épaule droite à la hanche gauche, bordée d'effets texturés. Blason rond Manchester City (voilier et rose rouge) côté cœur, sponsor Etihad Airways en bleu marine, logo Puma marine. Pièges : le bleu ciel City reste clair et doux — ne pas le foncer vers le bleu roi ; la diagonale est blanche et continue — ne pas l'omettre ni la doubler ; le dos est bleu ciel uni (nom et numéro bleu marine).",
  },
  {
    bench: 'juventus',
    db: 'juventus',
    fidelityNotes:
      "Rayures VERTICALES noires et blanches (bianconeri) à ÉPAISSEURS VARIABLES et décalées (effet code-barres signature 2025-26), accents ROSE pâle : logo adidas, blason « J » stylisé et 3 bandes d'épaules roses. Sponsors Jeep et Visit Detroit sur la poitrine. Pièges : les rayures restent verticales — jamais horizontales ; pas de gris : du noir et du blanc francs ; conserver l'irrégularité des épaisseurs comme sur les références ; dos blanc à larges rayures noires en bas.",
  },
  {
    bench: 'bresil',
    db: 'bresil',
    fidelityNotes:
      "Maillot JAUNE canari (coupe rétro inspirée de 1970), col rond à ENCOCHE en V vert foncé, bouts de manches à liseré vert foncé, empiècements latéraux vert émeraude, swoosh vert. Blason CBF surmonté de 5 étoiles et souligné « BRASIL » côté cœur. Pièges : le jaune reste vif (pas de moutarde ni d'or) ; le vert n'apparaît qu'en accents (col, manches, côtés) ; pas de sponsor poitrine (sélection nationale) ; nom et numéro du dos en VERT FONCÉ à contour turquoise.",
  },
  {
    bench: 'argentine',
    db: 'argentine',
    fidelityNotes:
      'Rayures VERTICALES bleu ciel et blanches (albiceleste) avec DÉGRADÉ dans les bandes bleues (trois tons de bleu, hommage aux sacres 1978/1986/2022), épaules et 3 bandes adidas BLEU MARINE, bouts de manches marine. Blason AFA monochrome DORÉ surmonté de 3 étoiles dorées, logo adidas doré, badge doré FIFA World Champions 2022 au centre. Pièges : les rayures sont verticales et larges — pas de bleu uni ; reproduire le dégradé des bandes ; pas de sponsor poitrine (sélection nationale) ; nom et numéro du dos en BLEU MARINE, « 1893 » en haut du dos.',
  },
]

export default class CustomArtSeedKits extends BaseCommand {
  public static commandName = 'custom_art:seed_kits'
  public static description =
    'Seed des réfs maillot (15 équipes) vers le storage + kit_ref_urls en DB'

  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  @flags.boolean({ description: 'Remplace des kit_ref_urls déjà renseignées' })
  public force: boolean

  public async run() {
    // Imports dynamiques : le conteneur IoC n'est prêt qu'à l'exécution de la commande
    const { default: CustomArtTeam } = await import('App/Models/CustomArtTeam')
    const { default: CustomArtStorage } = await import('App/Services/CustomArt/Storage')

    const kitsDir = join(this.application.appRoot, 'scripts', 'bench', 'kits')

    for (const { bench, db, fidelityNotes } of BENCH_TEAMS) {
      const team = await CustomArtTeam.findBy('slug', db)
      if (!team) {
        this.logger.warning(`équipe "${db}" introuvable en DB (seed M4 non joué ?) — sautée`)
        continue
      }

      const existing = team.kitRefUrls || []
      if (existing.length > 0 && !this.force) {
        this.logger.info(
          `${db} : ${existing.length} image(s) déjà en place — sautée (utilise --force pour remplacer)`
        )
        continue
      }

      // Ordre [dos, front] (comme le bench) ; suffixes -back/-front conservés dans la clé
      const urls: string[] = []
      for (const view of ['back', 'front']) {
        const file = `${bench}-home-${view}.jpg`
        const buffer = await fs.readFile(join(kitsDir, file))
        const key = `custom-art/teams/${db}/${file}`
        await CustomArtStorage.put(key, buffer, { contentType: 'image/jpeg', isPublic: true })
        urls.push(CustomArtStorage.publicUrl(key))
      }

      team.kitRefUrls = urls
      // Notes calibrées du bench : validées avec ces images exactes (le prompt et le
      // juge doivent décrire le MÊME maillot que les références)
      team.fidelityNotes = fidelityNotes
      await team.save()

      this.logger.success(`${db} : 2 réfs poussées (dos + face) + notes de fidélité calibrées`)
    }

    this.logger.info('Terminé. Les 15 équipes de la bibliothèque sont couvertes par ce seed.')
  }
}
