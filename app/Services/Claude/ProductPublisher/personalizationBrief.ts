/**
 * BRIEF DE PERSONNALISATION — ce que l'IA éditoriale ignorait.
 *
 * POURQUOI : DescriptionGenerator et TitleAndSeoGenerator ne reçoivent que l'IMAGE, la collection
 * et le type de produit. Pour un poster personnalisé, ils décrivent donc une jolie affiche
 * décorative — sans jamais dire que l'acheteur envoie SA photo et reçoit SA version. Constaté sur
 * le poster « Dog Mom » (19/08/2026) : joli texte, mais on n'y comprenait pas que c'était
 * personnalisable, et le référencement passait à côté de la requête qui compte
 * (« poster personnalisé chien »).
 *
 * Ce brief est construit à partir du PARCOURS RÉEL (studio.config) et de la recette : on ne
 * devine rien, on décrit ce que le client fera vraiment.
 */

/** Libellé FR d'une map i18n (le builder n'écrit que le français, traduit à la publication). */
function fr(map: any): string {
  if (!map) return ''
  if (typeof map === 'string') return map.trim()
  return typeof map.fr === 'string' ? map.fr.trim() : ''
}

const ANGLE_FR: Record<string, string> = {
  'front': 'de face',
  'three-quarter': 'de trois-quarts',
  'profile': 'de profil',
  'back': 'de dos',
}

/**
 * Rend le brief FR, ou `null` si le produit n'est pas personnalisé / la config illisible
 * (l'appelant retombe alors sur le comportement historique, inchangé).
 */
export function buildPersonalizationBrief(studioConfig: any, studioRecipe: any): string | null {
  const steps: any[] = Array.isArray(studioConfig?.steps) ? studioConfig.steps : []
  if (!steps.length) return null

  const photo = steps.find((s) => s && s.type === 'photo')
  const texts = steps.filter((s) => s && ['text', 'number', 'date'].includes(s.type))
  const lines: string[] = []

  if (photo) {
    const angleKey = photo.faceAngle
    const angle = ANGLE_FR[angleKey] || null
    const help = fr(photo.help)
    lines.push(
      `- L'acheteur téléverse SA PROPRE PHOTO${angle ? `, prise ${angle}` : ''}, et le studio y redessine ` +
        `ses sujets dans le style exact de cette œuvre. Le dessin montré ici est un EXEMPLE : ` +
        `chaque acheteur reçoit SA version.`
    )
    if (help) lines.push(`- Consigne de prise de vue donnée au client : « ${help} »`)
    const people = photo.photoPolicy?.people
    if (photo.photoPolicy?.subject === 'group' && people?.max) {
      lines.push(`- Le dessin peut réunir jusqu'à ${people.max} personnes.`)
    }
  }

  for (const step of texts) {
    const label = fr(step.label) || fr(step.title)
    if (label) lines.push(`- L'acheteur saisit : ${label.toLowerCase()}.`)
  }

  // Texte imprimé tel quel sur chaque tirage (titre décoratif lu sur le design, sans champ client).
  const refTitle = studioRecipe?.reference?.texts?.title
  const tpl = studioRecipe?.inputs?.title?.template
  if (refTitle && tpl && !/\{[^{}]+\}/.test(String(tpl))) {
    lines.push(`- La mention « ${refTitle} » est imprimée telle quelle sur chaque exemplaire.`)
  }

  if (!lines.length) return null

  return `
<personnalisation>
  <!-- CE PRODUIT EST PERSONNALISÉ. C'est l'information la plus importante de la fiche :
       sans elle, l'acheteur croit acheter une affiche déjà faite. -->
  <ce_que_fait_le_client>
${lines.join('\n')}
  </ce_que_fait_le_client>

  <regles_absolues>
    - Dès le PREMIER paragraphe, l'acheteur doit comprendre que c'est SA photo qui devient l'œuvre.
      Écris-le en clair, pas en sous-entendu poétique.
    - Ne présente JAMAIS le dessin montré comme la pièce qu'il recevra : c'est un exemple.
      Parle de « votre » version, « votre » photo, « vos » mots.
    - Dis ce qu'il doit fournir, en une phrase concrète, et que la création est faite à la demande
      après commande.
    - N'invente aucune étape qui ne figure pas ci-dessus (pas de « choisissez vos couleurs » si ce
      n'est pas proposé).
  </regles_absolues>

  <structure_imposee>
    Cette fiche remplace la structure narrative par défaut :
    1. Deux ou trois paragraphes &lt;p&gt; d'accroche émotionnelle — dont le premier dit la personnalisation.
    2. Un &lt;h3&gt; « Comment ça marche » (formule libre) suivi d'un &lt;ul&gt; de 3 à 4 &lt;li&gt; :
       ce que le client fournit, ce que le studio en fait, l'aperçu avant achat, la fabrication à la demande.
       Chaque &lt;li&gt; commence par 2-4 mots en &lt;strong&gt;.
    3. Un &lt;h3&gt; sur l'occasion d'offrir, suivi d'un &lt;p&gt;.
    Les balises &lt;h3&gt;, &lt;ul&gt;, &lt;li&gt; et &lt;strong&gt; sont donc AUTORISÉES ici (elles ne le sont pas ailleurs).
  </structure_imposee>

  <referencement>
    - L'expression « poster personnalisé » (accordée au sujet : « poster personnalisé chien »,
      « poster personnalisé famille »…) doit apparaître dans le premier paragraphe ET dans un &lt;h3&gt;,
      écrite naturellement, jamais répétée mécaniquement.
    - Place aussi, une seule fois chacun et seulement s'ils sonnent juste : le mot décrivant le sujet
      réel de l'œuvre, une occasion d'offrir, et « à partir de votre photo ».
    - Zéro bourrage : si une expression ne passe pas naturellement dans la phrase, ne la mets pas.
  </referencement>
</personnalisation>`.trim()
}
