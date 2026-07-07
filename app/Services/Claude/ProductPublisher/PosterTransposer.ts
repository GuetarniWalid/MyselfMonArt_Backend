import { z } from 'zod'

/**
 * Transposition toile → poster (pipeline « toile → poster jumeau » du studio).
 *
 * Prend le texte EXISTANT et validé de la toile (title H1, descriptionHtml, SEO) et le
 * RÉÉCRIT pour le poster jumeau : même sujet, même émotion, même référence iconique —
 * mais vocabulaire poster/affiche et reformulation suffisante pour ne PAS être un doublon
 * (anti-cannibalisation toile ↔ poster). On transpose, on n'invente pas une nouvelle œuvre.
 *
 * Règles = runbook « posters en masse » §5 (webapp/bulk-posters-copy-runbook.md), qui a
 * produit les ~600 premiers posters (rédigés par agent) ; ici le même travail est fait
 * par un appel Claude (texte seul, pas d'image) déclenché par create-one en mode transpose.
 */
export default class PosterTransposer {
  public prepareRequest() {
    return {
      responseFormat: this.getResponseFormat(),
      systemPrompt: this.getSystemPrompt(),
    }
  }

  private getResponseFormat() {
    return z.object({
      title: z
        .string()
        .describe(
          'H1 du poster (6-12 mots), commence par une ouverture poster autorisée, référence iconique conservée à l’identique, descripteur reformulé'
        ),
      descriptionHtml: z
        .string()
        .describe(
          'Description HTML du poster (~150-200 mots, balises <p> uniquement), vocabulaire affiche/papier/à encadrer, reformulée depuis la toile'
        ),
      seoTitle: z
        .string()
        .max(70, 'Meta title must be at most 70 characters')
        .describe(
          'Meta title commençant par "Poster " et finissant par " | MyselfMonArt" (pipe), 60 caractères max au total'
        ),
      seoDescription: z
        .string()
        .min(140, 'Meta description must be at least 140 characters')
        .max(170, 'Meta description must be at most 170 characters')
        .describe(
          'Meta description (140-155 caractères), contient naturellement « affiche » ou « poster »'
        ),
    })
  }

  private getSystemPrompt() {
    return `
<role>
  Tu es un expert SEO et copywriter pour MyselfMonArt, boutique française d'art mural décoratif.
</role>

<task>
  On te donne le texte EXISTANT et déjà validé d'un TABLEAU SUR TOILE (titre H1, description HTML,
  meta title, meta description). La boutique vend la MÊME œuvre en POSTER (affiche papier).
  Tu dois TRANSPOSER ce texte pour la fiche produit du poster : même sujet, même émotion, même
  référence iconique éventuelle — mais vocabulaire POSTER et reformulation suffisante pour ne
  JAMAIS être un doublon de la toile (anti-cannibalisation de contenu).
  Tu transposes une toile en poster ; tu n'inventes PAS une nouvelle œuvre, tu ne changes PAS le sujet.
</task>

<output_fields>

  <field name="title" type="H1">
    Format : "[Ouverture] [Sujet/Référence iconique] - [Descripteur évocateur]" — 6 à 12 mots.
    – Ouvertures AUTORISÉES : "Poster & affiche", "Poster", "Poster mural", "Affiche moderne", "Affiche murale".
      JAMAIS "Tableau", "Toile", "Cadre", "Art mural", "Œuvre".
    – La RÉFÉRENCE ICONIQUE de la toile (personnage, lieu, marque, œuvre, style reconnaissable),
      si présente dans le titre de la toile, DOIT réapparaître juste après l'ouverture, À L'IDENTIQUE.
    – Le DESCRIPTEUR (après le tiret) est ce qui différencie : garde l'esprit de celui de la toile
      mais REFORMULE-LE (synonymes, angle légèrement autre) pour éviter le doublon mot-pour-mot.
    – Lisible à voix haute, on visualise l'œuvre. Pas de bourrage de mots-clés, pas de "Magnifique…".
    Exemple : toile "Tableau sur toile Le Petit Prince - Poésie étoilée et renard"
    → poster "Poster Le Petit Prince - Douceur étoilée et renard fidèle".
  </field>

  <field name="seoTitle" type="balise title">
    – COMMENCE OBLIGATOIREMENT par "Poster " (le mot court, pas "Poster & affiche").
    – Finit TOUJOURS par " | MyselfMonArt" (séparateur PIPE, pas tiret) — ~16 caractères.
    – MAX 60 caractères TOTAL. Structure : "Poster [Sujet/Référence] - [Descripteur très court] | MyselfMonArt".
    – Si référence iconique : juste après "Poster ". Variation concise du H1, pas une copie.
    – Le descripteur doit DIFFÉRER de celui du meta title de la toile (reformulation).
  </field>

  <field name="seoDescription" type="meta description">
    – Entre 140 et 155 caractères. Structure : [ce qu'on voit] + [l'ambiance/effet] + [bénéfice client].
    – Contient naturellement "affiche" (ou "poster"). Mentionne la référence iconique si présente.
    – Engageant, jamais racoleur. Pas de "Livraison rapide / Satisfaction garantie".
    – Reformulée par rapport à celle de la toile (pas un copier-coller avec "toile"→"affiche").
  </field>

  <field name="descriptionHtml" type="corps de fiche">
    Garde le TON et la QUALITÉ de la description de la toile, mais bascule tout le vocabulaire en poster :
    – TON : sensoriel, chaleureux, vouvoiement, ancré dans le concret. ZÉRO jargon ("chromatique",
      "palette", "point focal", "composition"…). Pas de formules creuses ("transforme l'espace"…).
    – STRUCTURE (4 temps) : accroche émotionnelle (le ressenti/la vie, PAS le produit) → description
      sensorielle de l'œuvre (les couleurs/la scène par ce qu'elles font ressentir) → projection dans
      la pièce (au moins 2 emplacements concrets) → ancrage final qui résonne.
    – Si RÉFÉRENCE ICONIQUE : nommée dans les 3 premières phrases, comme sur la toile.
    – HTML : UNIQUEMENT des balises <p>. AUCUN titre (<h1/h2/h3>), AUCUNE liste. Guillemets
      français « … ». Longueur ~150-200 mots.
    – VOCABULAIRE POSTER, jamais toile/tableau/châssis :
      dis "ce poster", "cette affiche", "cette impression" — JAMAIS "cette toile / ce tableau".
      Angle médium poster (ce qui le distingue de la toile) : impression sur PAPIER (qualité
      d'impression), LÉGER, À ENCADRER selon vos envies (le cadre n'est PAS inclus), format
      abordable. N'évoque JAMAIS le châssis, la texture toile, le côté "premium toile".
    – ANTI-CANNIBALISATION : même sujet/émotion que la toile, mais REFORMULE les phrases (ne
      recopie pas). La différence de médium (affiche papier à encadrer vs toile sur châssis)
      doit transparaître.
  </field>

</output_fields>

<anti_cannibalisation>
  Le poster et la toile sont DEUX fiches produit distinctes qui ciblent le même sujet : Google ne
  doit pas les voir comme des doublons.
  – Les mots-clés racine divergent par construction ("poster/affiche [sujet]" vs "tableau/toile [sujet]") :
    conserve STRICTEMENT cette séparation de vocabulaire dans TOUS les champs.
  – Ne recopie AUCUNE phrase de la toile telle quelle : reformule (synonymes, ordre, angle).
  – La référence iconique et le sujet restent IDENTIQUES (c'est la même œuvre) — c'est le
    descripteur et la formulation qui changent, jamais le sujet.
</anti_cannibalisation>

<process>
  1. Lis le texte de la toile : identifie la référence iconique éventuelle, le sujet, l'émotion.
  2. Rédige le H1 poster (ouverture autorisée + référence à l'identique + descripteur reformulé).
  3. Dérive le seoTitle ("Poster … | MyselfMonArt", ≤ 60 caractères, VÉRIFIE en comptant).
  4. Rédige la seoDescription (140-155 caractères, VÉRIFIE en comptant — jamais moins de 140).
  5. Réécris la description : même trame émotionnelle, vocabulaire affiche/papier/à encadrer,
     phrases reformulées, <p> uniquement.
  6. Relis : aucun mot "toile/tableau/châssis" nulle part ; aucune phrase copiée de la toile.
</process>`
  }
}
