import Logger from '@ioc:Adonis/Core/Logger'
import { GoogleGenAI } from '@google/genai'
import { noThinking, THINKING_HEADROOM_TOKENS } from 'App/Services/Gemini/thinking'

/**
 * STUDIO-DIRECTOR : lit le DESIGN et décide TOUT le paramétrage du parcours client, au moment
 * où Walid dépose son image dans le Publisher personnalisé.
 *
 * POURQUOI : c'était le dernier travail manuel de l'outil. Deux décisions y vivaient, et aucune
 * des deux n'était devinable sans regarder l'œuvre :
 *   1. QUELS champs demander au client (un prénom ? plusieurs ? une date ? un message ?) ;
 *   2. QUELLE photo le client doit fournir — et surtout sous quel ANGLE. Un design qui montre
 *      les sujets DE DOS ne peut rien faire d'une photo de face : le juge photo doit la refuser
 *      AVANT la génération, sinon le client paie un rendu qui ne lui ressemblera pas.
 * Le RecipeDirector (qui écrit le prompt) tourne APRÈS, sur les champs choisis ici.
 *
 * SOLIDITÉ : vocabulaire FERMÉ. Le modèle ne rédige aucune structure — il CHOISIT dans le
 * catalogue d'étapes que le front lui envoie et note chaque angle dans une échelle à 3 crans.
 * Tout est re-whitelisté en code ci-dessous ; une sortie douteuse retombe sur `null` et le
 * builder garde ses valeurs actuelles (jamais de config à moitié écrite).
 */

const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash'

/** Une étape proposable, telle que le front la connaît (catalogue de personalized.js). */
export interface StudioCatalogEntry {
  id: string
  payloadKey: string
  type: string
  titleFr: string
}

export type PhotoAngle = 'front' | 'three-quarter' | 'profile' | 'back'
export type PhotoGrade = 'perfect' | 'warn' | 'reject'

export interface StudioPhotoPlan {
  subject: 'person' | 'group'
  framing: 'face' | 'full-body'
  /** Bornes du nombre de personnes — uniquement en mode groupe (sinon null). */
  people: { min: number; max: number } | null
  /** Angle de prise de vue → verdict du juge photo. EXACTEMENT un `perfect`. */
  angles: Record<PhotoAngle, PhotoGrade>
  /** Consigne affichée au client sous l'étape photo (FR ; traduite à la publication). */
  helpFr: string
  /** Titre de l'étape photo (FR) — « Votre photo avec votre chien », etc. */
  titleFr: string
  /** Refus de cadrage, message client (FR). null = message générique du thème. */
  rejectFramingFr: string | null
  /** Angle toléré mais non idéal, message client (FR). null = message générique. */
  warnAngleFr: string | null
  /**
   * Angle REFUSÉ, message client (FR). Sans lui, le thème sert un texte générique inadapté
   * (« Il faut une photo de l'arrière de la tête ») sur un poster en pied.
   */
  rejectAngleFr: string | null
  /**
   * Légendes des deux images d'exemple (FR).
   * - `badCaptionFr` est LU PAR L'ACHETEUR sous l'image « à éviter » (le thème n'a qu'un texte
   *   générique en repli) : c'est le seul des trois qui se voit.
   * - les deux `alt` ne servent qu'à l'accessibilité et au référencement.
   * La légende de la BONNE image n'est pas ici : le thème l'écrit lui-même d'après `faceAngle`
   * (« Photo idéale : prise de dos, en pied… ») — elle suit donc la grille d'angles toute seule.
   */
  badCaptionFr: string | null
  goodAltFr: string | null
  badAltFr: string | null
}

export interface StudioPlan {
  /** ids du catalogue, dans l'ordre où le client doit les remplir (photo/format exclus). */
  fields: string[]
  /** null = ce design ne part pas d'une photo client (produit 100 % texte). */
  photo: StudioPhotoPlan | null
  /** Animal de compagnie dessiné sur le design (le prompt doit en tenir compte). */
  animals: { present: boolean; kinds: string[] }
  /** Une phrase FR pour les logs / le retour à Walid : ce que l'IA a lu. */
  noteFr: string
}

const ANGLES: PhotoAngle[] = ['front', 'three-quarter', 'profile', 'back']
const GRADES = new Set<string>(['perfect', 'warn', 'reject'])
// tokens.max du builder est borné 1..8 (validateRecipeClient) et people.max le pilote.
const PEOPLE_MAX_CAP = 8

const DIRECTOR_INSTRUCTION = `You configure the customer journey of a personalized-art e-commerce studio.

You are shown ONE image: a DESIGN the shop sells. A customer will buy it personalized: they upload a photo of themselves, an image AI redraws THEIR subjects in this design's exact style, and their own words replace the words written on the design.

Your job: read the design and decide what the shop must ask that customer.

OUTPUT strict JSON only, exactly these keys:
{"fields": string[], "photoNeeded": boolean, "subject": "person"|"group", "framing": "face"|"full-body", "peopleMin": number, "peopleMax": number, "angles": {"front": g, "three-quarter": g, "profile": g, "back": g}, "photoTitleFr": string, "photoHelpFr": string, "rejectFramingFr": string, "warnAngleFr": string, "rejectAngleFr": string, "badCaptionFr": string, "goodAltFr": string, "badAltFr": string, "animals": string[], "noteFr": string}
where each g is one of "perfect" | "warn" | "reject".

"fields" — pick ONLY from the ids in CATALOG below, in the order the customer should fill them.
Include an id when the design carries that information and it changes per customer: a family
surname on the design -> the surname field; one caption per figure -> the multiple-first-names
field; a single name -> the single-first-name field; a date -> the matching date field; a free
sentence -> the message field. Include NOTHING the design does not display. Never invent an id.

"photoNeeded" — true when the design's figures are people who must resemble the buyer (they will
be redrawn from the buyer's photo). false when the artwork is purely typographic or decorative.

THE ANGLE GRID — the part that matters most. Grade the FOUR shooting angles by what THIS design
shows. A design whose figures are seen from behind cannot be built from a photo taken from the
front: the drawing would either contradict the photo or expose a face the design never shows.
- "perfect": the angle the design actually depicts. EXACTLY ONE angle carries "perfect".
- "reject": an angle that would make a faithful result impossible. The photo is refused before
  any generation is paid for. Use it whenever the design commits to one viewpoint.
- "warn": an angle that still yields an acceptable result. Use it only when it truly does.
When the design's own figures face in more than one direction, or the style is so abstract that
the viewpoint carries no information, grade every angle "warn" except the dominant one.

"subject"/"peopleMin"/"peopleMax" — "person" when the design holds exactly one figure (send
peopleMin=1, peopleMax=1); "group" when it holds several or the count can vary with the buyer's
family. Never exceed ${PEOPLE_MAX_CAP}.
"framing" — "full-body" when the figures are drawn head to feet, "face" when only head/shoulders.

"photoTitleFr", "photoHelpFr", "rejectFramingFr", "warnAngleFr" — FRENCH, addressed to the buyer
with "vous". The title is a short heading ("Votre photo de dos"). The help is one or two plain
sentences naming the angle to shoot, what must be fully visible, and any animal that must appear
in the shot. rejectFramingFr is what to say when the framing is wrong; warnAngleFr when the angle
is tolerated but not ideal; rejectAngleFr when the buyer shot the REJECTED angle — say which angle
to take instead and why this artwork needs it, in one sentence. Everyday French, no jargon, never mention AI or prompts.

"badCaptionFr", "goodAltFr", "badAltFr" — FRENCH, about the two EXAMPLE photos shown to the buyer.
"badCaptionFr" is read by the buyer under the "avoid this" picture: name the ONE mistake that this
design cannot survive — and that mistake is the angle you graded "reject", not a generic blur or a
dark room. Open with "À éviter : ". Example for a design drawn from behind: "À éviter : de face —
on verrait votre visage, alors que le dessin vous montre de dos." The two alt texts describe what
each picture shows, for screen readers; keep them factual and short.

"animals" — the companion animals DRAWN on the design, lowercase French singular ("chien",
"chat"), empty when there are none. An animal here means the buyer must bring theirs.
"noteFr" — ONE French sentence for the shop owner: what you read on the design and why this angle.

No preamble, no markdown fence.`

export default class StudioDirector {
  private ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

  /**
   * Lit le design et rend le plan complet du parcours. `catalog` = étapes proposables (le front
   * en est la source de vérité : elles y sont déjà rédigées et traduites). `null` = analyse
   * inexploitable → l'appelant garde le paramétrage courant.
   */
  public async plan(designB64: string, catalog: StudioCatalogEntry[]): Promise<StudioPlan | null> {
    if (!process.env.GEMINI_API_KEY) return null
    if (!catalog.length) return null
    const m = /^data:(.+?);base64,(.+)$/s.exec(designB64)
    const mimeType = m ? m[1] : 'image/jpeg'
    const data = m ? m[2] : designB64
    const lines = catalog.map((c) => `- ${c.id} — « ${c.titleFr} »`).join('\n')
    try {
      const config: any = {
        systemInstruction: DIRECTOR_INSTRUCTION,
        temperature: 0.2,
        // 1200 = la réponse seule ; la marge protège d'une réflexion résiduelle (cf. thinking.ts).
        maxOutputTokens: 1200 + THINKING_HEADROOM_TOKENS,
        responseMimeType: 'application/json',
      }
      config.thinkingConfig = noThinking(TEXT_MODEL)
      const rsp: any = await Promise.race([
        this.ai.models.generateContent({
          model: TEXT_MODEL,
          contents: [
            { inlineData: { mimeType, data } },
            { text: `CATALOG:\n${lines}\nConfigure the journey for this design.` },
          ],
          config,
        }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('StudioDirector timeout')), 90000)),
      ])
      const raw = (typeof rsp?.text === 'string' ? rsp.text : '').trim()
      const parsed = JSON.parse(
        raw
          .replace(/^```(?:json)?/i, '')
          .replace(/```$/, '')
          .trim()
      )
      return this.sanitize(parsed, catalog)
    } catch (e) {
      Logger.warn('StudioDirector failed: %s', (e as any)?.message || e)
      return null
    }
  }

  /**
   * Re-whitelist TOUT (données modèle = données non fiables). Un plan sans champ exploitable ou
   * sans grille d'angles utilisable → null : mieux vaut le paramétrage actuel qu'un demi-plan.
   */
  private sanitize(parsed: any, catalog: StudioCatalogEntry[]): StudioPlan | null {
    if (!parsed || typeof parsed !== 'object') return null
    const known = new Set(catalog.map((c) => c.id))
    const str = (v: any, max: number): string =>
      typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : ''

    // Champs : ids connus, dédupliqués, ordre du modèle conservé.
    const fields: string[] = []
    for (const raw of Array.isArray(parsed.fields) ? parsed.fields : []) {
      const id = String(raw || '').trim()
      if (known.has(id) && !fields.includes(id)) fields.push(id)
    }

    const animalKinds: string[] = (Array.isArray(parsed.animals) ? parsed.animals : [])
      .map((a: any) => str(a, 24).toLowerCase())
      .filter(Boolean)
      .slice(0, 4)

    let photo: StudioPhotoPlan | null = null
    if (parsed.photoNeeded === true) {
      // Grille d'angles : les 4 crans doivent être notés, et un SEUL peut être « parfait » —
      // c'est lui qui devient la consigne de prise de vue (faceAngle) côté studio. Sans cet
      // invariant, la consigne serait arbitraire : on préfère alors ne rien imposer.
      const angles = {} as Record<PhotoAngle, PhotoGrade>
      const rawAngles = parsed.angles && typeof parsed.angles === 'object' ? parsed.angles : {}
      let perfects = 0
      for (const a of ANGLES) {
        const g = String(rawAngles[a] || '')
          .trim()
          .toLowerCase()
        if (!GRADES.has(g)) return null
        angles[a] = g as PhotoGrade
        if (g === 'perfect') perfects++
      }
      if (perfects !== 1) return null

      const subject: 'person' | 'group' = parsed.subject === 'group' ? 'group' : 'person'
      const framing: 'face' | 'full-body' = parsed.framing === 'face' ? 'face' : 'full-body'
      const num = (v: any, dflt: number): number =>
        Number.isFinite(v) ? Math.min(PEOPLE_MAX_CAP, Math.max(1, Math.trunc(v))) : dflt
      let people: { min: number; max: number } | null = null
      if (subject === 'group') {
        const max = num(parsed.peopleMax, 6)
        people = { min: Math.min(num(parsed.peopleMin, 1), max), max }
      }

      const helpFr = str(parsed.photoHelpFr, 300)
      const titleFr = str(parsed.photoTitleFr, 80)
      // La consigne client est le SEUL texte qui porte l'angle jusqu'à l'acheteur : sans elle,
      // le plan n'apporte rien de plus qu'aujourd'hui.
      if (!helpFr || !titleFr) return null
      photo = {
        subject,
        framing,
        people,
        angles,
        helpFr,
        titleFr,
        rejectFramingFr: str(parsed.rejectFramingFr, 220) || null,
        warnAngleFr: str(parsed.warnAngleFr, 220) || null,
        rejectAngleFr: str(parsed.rejectAngleFr, 220) || null,
        // Facultatifs : absents -> l'appelant garde les légendes en place (jamais de rejet du
        // plan entier pour une légende manquante).
        badCaptionFr: str(parsed.badCaptionFr, 160) || null,
        goodAltFr: str(parsed.goodAltFr, 160) || null,
        badAltFr: str(parsed.badAltFr, 160) || null,
      }
    }

    // Ni champ ni photo = rien d'exploitable (le design n'a pas été lu).
    if (!fields.length && !photo) return null

    return {
      fields,
      photo,
      animals: { present: animalKinds.length > 0, kinds: animalKinds },
      noteFr: str(parsed.noteFr, 300),
    }
  }
}
