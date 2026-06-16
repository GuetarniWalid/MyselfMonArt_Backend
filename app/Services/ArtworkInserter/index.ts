import Logger from '@ioc:Adonis/Core/Logger'
import sharp from 'sharp'
import { GoogleGenAI } from '@google/genai'

type Target = 'portrait' | 'square' | 'landscape'
type Product = 'canvas' | 'poster' | 'tapestry'

export interface InsertOptions {
  product?: Product
  fidelity?: 'standard' | 'high' // 'high' = Nano Banana Pro (meilleur sur le texte, ~3x plus cher)
  // Jumeau « passe-partout » : l'œuvre fournie inclut DÉJÀ une marge blanche imprimée (mat). Le prompt
  // poster standard dit « NO mat / fill edge-to-edge » -> le modèle RECADRE et fait disparaître la marge.
  // Avec mat=true on bascule sur des clauses qui PRÉSERVENT la bordure blanche (cf. buildInsertionPrompt).
  mat?: boolean
}

// Le DÉCOR est désormais TOUJOURS CARRÉ (cf. DecorGenerator) -> la sortie d'insertion est elle aussi
// verrouillée en 1:1 pour épouser le décor sans reframing. Le tableau (support) dans la pièce garde sa
// forme (portrait/carré/paysage) : c'est la zone grise à remplir, PAS le ratio de l'image. `target` ne
// sert donc plus qu'à valider l'entrée (un vieux décor sauvegardé non carré serait recadré en carré).
const OUTPUT_ASPECT_RATIO = '1:1'
// Sortie 2K (décision 12/06) : c'est l'image FINALE envoyée à Shopify -> zoom net en fiche produit.
// Le décor 1K en entrée n'est pas un problème : le modèle re-rend toute la scène à 2K.
const INSERT_IMAGE_SIZE = '2K'
const TARGET = {
  portrait: { ratio: '3:4' },
  square: { ratio: '1:1' },
  landscape: { ratio: '4:3' },
} as const

// IDs modèles GA uniquement : Google éteint les alias '-preview' 3.x le 25/06/2026. Contrairement
// au constat du 04/06, les ids GA sont fiables (re-testés en API directe le 12/06 + bench M1 CustomArt).
// Standard = NB2 (gemini-3.1-flash-image) depuis la migration du 12/06 — meilleure fidélité de
// référence que 2.5 pour ~+3 ¢/image ; la case « haute fidélité » reste sur Pro.
const FLASH_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image'
const PRO_MODEL = process.env.GEMINI_IMAGE_MODEL_HIGH || 'gemini-3-pro-image'
// Modèle de SECOURS quand le modèle principal renvoie une réponse SANS image. Les modèles gemini-3.x
// REFUSENT en entrée toute image de référence contenant une PERSONNE (filtre anti face-swap :
// blockReason=OTHER, échec en ~2s — confirmé le 15/06). gemini-2.5-flash-image a un filtre d'entrée
// moins strict et accepte les œuvres figuratives (ex. un footballer) : c'est le filet anti-refus.
// cf. CustomArt/providers/GeminiProvider (acceptsPersonRefs = !model.startsWith('gemini-3')).
const FALLBACK_MODEL = process.env.GEMINI_IMAGE_MODEL_FALLBACK || 'gemini-2.5-flash-image'

// Vocabulaire d'insertion par PRODUIT : le support n'est PAS toujours un cadre.
// - canvas   : toile tendue sur châssis (gallery-wrapped), AUCUN cadre -> sinon Gemini en invente un.
// - poster   : feuille imprimée dans un cadre fin (le cadre existe vraiment).
// - tapestry : panneau textile tissé suspendu à une tringle, sans cadre ni verre.
const SUPPORT: Record<
  Product,
  {
    surface: string // nom du support tel qu'il apparaît dans le décor
    face: string // nom de la surface grise à remplir
    mounted: string // "...comme la vraie oeuvre <mounted>"
    fitClause: string // précision sur l'ajustement bord à bord / wrap
    texture: string // texture de surface réaliste (toile = tissage fin, poster = papier mat…)
    supportRule: string // règle dure spécifique au support (cadre ou pas)
    negative: string // rappel négatif final propre au support
  }
> = {
  canvas: {
    surface:
      'gallery-wrapped stretched canvas (a bare canvas stretched over a wooden stretcher frame, NO surrounding picture frame)',
    face: 'canvas face',
    mounted: 'artwork printed directly onto that bare stretched canvas',
    fitClause:
      'The print covers the canvas face edge-to-edge; if the thin wrapped side edges (the shallow depth of the canvas) are visible, let the artwork wrap cleanly and continuously around them. Keep the canvas perfectly flat and planar with its clean wrapped edges and subtle shallow depth.',
    texture:
      'The artwork is printed on a REAL stretched cotton/linen canvas: render a FINE, SUBTLE woven canvas weave across the whole surface and along the wrapped edges, catching the light very slightly so the texture is visible but delicate — never a coarse burlap weave, never a glossy sheen; keep it matte and true to the artwork colours.',
    supportRule:
      'This is a FRAMELESS gallery-wrapped canvas — it is a canvas, NOT a poster and NOT a framed picture. Do NOT add or invent any frame, border, mat, passe-partout, fillet, molding or glass around it. The image goes directly onto the bare stretched canvas, edge-to-edge. Reuse the exact frameless canvas object already in the FIRST image and keep it frameless.',
    negative:
      'no added frame, no border, no mat, no molding, no glass — it stays a bare frameless gallery-wrapped stretched canvas with clean wrapped edges and a fine matte canvas weave',
  },
  poster: {
    surface: 'framed poster: a flat printed sheet inside the slim minimalist frame already present',
    face: 'poster sheet area',
    mounted: 'real printed poster mounted in that existing frame',
    fitClause:
      'The print fills the whole aperture edge-to-edge with NO mat / no passe-partout, sitting flat behind the frame opening.',
    texture:
      'The poster is a flat matte printed sheet with a smooth paper surface — no canvas weave, no gloss, no glass glare.',
    supportRule:
      'Reuse the slim frame that is ALREADY in the FIRST image. Do NOT add a SECOND frame, extra border, mat or molding. The artwork stays strictly inside the existing aperture.',
    negative: 'no second frame, no extra border or mat, keep the single slim frame already present',
  },
  tapestry: {
    surface:
      'soft woven wall tapestry / textile panel hung flat from a slim wooden rod (no frame, no glass)',
    face: 'textile face',
    mounted: 'design woven into that hanging textile panel',
    fitClause:
      'The artwork sits flat across the rectangular textile face, following its subtle natural weave and any gentle fabric undulation, edge-to-edge with no leftover grey band.',
    texture:
      'The design reads as WOVEN into the textile: a soft natural fabric weave across the whole face, gently following any fabric undulation — matte, no gloss.',
    supportRule:
      'This is a soft textile hung from a slim rod — NOT a framed picture. Do NOT add any frame, border, mat, molding or glass. Keep the existing tapestry object and its rod exactly as they are.',
    negative: 'no frame, no glass, no border — keep the hanging woven textile look',
  },
}

// Prompt d'insertion PRODUIT-AWARE : place l'oeuvre dans la surface vide grise du bon support
// (toile nue / poster encadré / tapisserie), fidèlement, sans rien toucher d'autre dans la pièce.
// mat=true (jumeau passe-partout) : l'œuvre fournie a DÉJÀ une marge blanche imprimée -> on remplace
// les clauses anti-mat du support par des clauses qui la conservent (le poster standard la supprimait).
function buildInsertionPrompt(product: Product, mat = false): string {
  const s = SUPPORT[product]
  const fitClause = mat
    ? 'IMPORTANT — the SECOND image ALREADY INCLUDES a clean, even, printed WHITE border (a passe-partout / mat) around the central artwork. Treat the WHOLE second image — white border INCLUDED — as a single printed sheet and place that whole sheet flat into the grey area, filling it edge-to-edge. The white margin MUST stay clearly visible as an EVEN white band on all four sides between the support and the inner artwork. Do NOT crop it out, do NOT trim or zoom past it, and do NOT enlarge only the inner artwork to cover the white border — keep the white mat exactly as in the second image.'
    : s.fitClause
  const supportRule = mat
    ? `${s.supportRule} The WHITE margin around the artwork is a printed mat (passe-partout) that is PART of the SECOND image — KEEP it intact and even; it is NOT a second frame and must NOT be removed.`
    : s.supportRule
  const negative = mat
    ? 'keep the even WHITE passe-partout margin around the artwork exactly as in the second image — never remove, crop or cover it'
    : s.negative
  return `You are compositing two images. The FIRST image is an interior photograph that contains ONE empty ${s.surface}, with a flat light-grey (#ECECEC) ${s.face}. The SECOND image is an artwork${mat ? ' that already includes a printed white passe-partout border (mat) around it' : ''}.

Task: place the SECOND image (the artwork) so it fills EXACTLY the empty light-grey ${s.face} of the existing support in the FIRST image, as if it were the real ${s.mounted}.

Hard rules:
- Keep the artwork 100% identical to the SECOND image: same colors, same patterns, same composition, same brush/print texture, and reproduce any text or signature exactly, character-for-character, with the same fonts and layout. Do NOT redraw, restyle, re-illustrate, crop, mirror, or re-interpret the artwork.
- Only fit the artwork to the grey ${s.face}. Match its perspective, scale and corners so the artwork sits flat with correct foreshortening, edge to edge, with no leftover grey band. ${fitClause}
- SURFACE TEXTURE (important): ${s.texture}
- CONTACT SHADOW, NOT FLOATING (important): match how the support actually sits in the FIRST image. If it HANGS ON A WALL, it sits flat and CLOSE against the wall (only a few centimetres deep): cast only a SMALL, soft, TIGHT contact shadow hugging its edges — a thin shadow just under the top edge and along the side away from the light source — so it clearly reads as mounted ON the wall. If it RESTS, LEANS or STANDS on a surface (table, shelf, console, mantel, easel or floor), cast the contact shadow where it meets that surface — pooling at its BASE and along its leaning edge — consistent with that surface and the light. In every case it must read as physically supported, never floating like a button, and NEVER with a large, soft, detached drop shadow or a wide gap of shadow.
- Adapt ONLY global lighting to the room: apply the same soft light direction already present, so it looks naturally lit. The support is MATTE (no glass, no sheen): do NOT add any glossy reflection, specular highlight or glare — keep its surface matte. Do not alter the artwork's own colors or content.
- SUPPORT TYPE (critical): ${supportRule}
- Keep EVERYTHING ELSE in the FIRST image exactly the same: walls, furniture, floor, decor, the support itself, lighting and camera. Change nothing outside the grey ${s.face}.

Output: a single photorealistic image, same framing and aspect ratio as the FIRST image, high fidelity, ${negative}, no text added, no watermark.`
}

function parseImage(input: string): { mimeType: string; data: string } {
  const m = input.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/)
  if (m) return { mimeType: m[1], data: m[2] }
  return { mimeType: 'image/jpeg', data: input.includes(',') ? input.split(',')[1] : input }
}

// Filtres de sécurité CONFIGURABLES desserrés au maximum autorisé. N.B. : certains blocs (sécurité
// « personnes » des modèles 3.x, CSAM…) ne sont PAS débrayables côté API — d'où le filet par modèle
// (FALLBACK_MODEL). Inoffensif quand rien n'est bloqué (vérifié en repro le 15/06).
const SAFETY_SETTINGS = [
  'HARM_CATEGORY_HARASSMENT',
  'HARM_CATEGORY_HATE_SPEECH',
  'HARM_CATEGORY_SEXUALLY_EXPLICIT',
  'HARM_CATEGORY_DANGEROUS_CONTENT',
  'HARM_CATEGORY_CIVIC_INTEGRITY',
].map((category) => ({ category, threshold: 'BLOCK_NONE' }))

// imageConfig selon le modèle : imageSize 2K n'existe que sur la génération 3.x ; 2.5 le rejette.
function imageConfigFor(model: string) {
  return model.startsWith('gemini-3')
    ? { aspectRatio: OUTPUT_ASPECT_RATIO, imageSize: INSERT_IMAGE_SIZE }
    : { aspectRatio: OUTPUT_ASPECT_RATIO }
}

// Extrait une raison LISIBLE d'une réponse Gemini SANS image (le SDK ne jette pas : il renvoie un 200
// vide). Sans ça on était aveugle (« Rendu vide » générique). Expose blockReason du prompt, finishReason
// du candidat, catégories de safetyRatings déclenchées, et tout texte de refus renvoyé.
function describeRefusal(rsp: any): string {
  const blockReason = rsp?.promptFeedback?.blockReason
  const finishReason = rsp?.candidates?.[0]?.finishReason
  const ratings = rsp?.candidates?.[0]?.safetyRatings || rsp?.promptFeedback?.safetyRatings || []
  const flagged = ratings
    .filter(
      (r: any) => r?.blocked || (r?.probability && !['NEGLIGIBLE', 'LOW'].includes(r.probability))
    )
    .map((r: any) => `${r.category}:${r.probability}${r.blocked ? '/blocked' : ''}`)
  const textPart = (rsp?.candidates?.[0]?.content?.parts || [])
    .map((p: any) => p?.text)
    .filter(Boolean)
    .join(' ')
    .slice(0, 200)
  const bits: string[] = []
  if (blockReason) bits.push(`blockReason=${blockReason}`)
  if (finishReason && finishReason !== 'STOP') bits.push(`finishReason=${finishReason}`)
  if (flagged.length) bits.push(`safety=[${flagged.join(',')}]`)
  if (textPart) bits.push(`text="${textPart}"`)
  return bits.length ? bits.join(' ') : 'réponse vide sans raison explicite'
}

/**
 * Insère l'oeuvre dans le cadre vide du décor via Nano Banana (Gemini image), 2 images en entrée.
 * Génératif (re-synthèse de la zone du cadre) : fidélité "commerciale + re-roll", pas pixel-perfect.
 * Retourne un data URI JPEG.
 */
export default class ArtworkInserter {
  // Clé Gemini DÉDIÉE (AI Studio), distincte de GOOGLE_API_KEY (projet sans l'API Gemini, qui 403).
  // Lue via process.env pour ne pas dépendre de env.ts. NB : le SDK loggue « Both GOOGLE_API_KEY and
  // GEMINI_API_KEY are set. Using GOOGLE_API_KEY. » — message TROMPEUR : la clé passée en option ci-
  // dessous gagne (vérifié le 15/06 : ai.apiKey == GEMINI_API_KEY, et le rendu marche). À ignorer.
  private ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

  public async insert(
    decorInput: string,
    artworkInput: string,
    target: Target,
    opts: InsertOptions = {}
  ): Promise<string> {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('Insertion indisponible : clé Gemini (GEMINI_API_KEY) non configurée.')
    }
    const t = TARGET[target]
    if (!t) throw new Error(`Cible invalide: ${target}`)
    const model = opts.fidelity === 'high' ? PRO_MODEL : FLASH_MODEL
    // Le support dicte le prompt : un canvas est une toile NUE (pas de cadre), à préciser à l'insertion.
    const product: Product =
      opts.product === 'poster' ? 'poster' : opts.product === 'tapestry' ? 'tapestry' : 'canvas'
    const prompt = buildInsertionPrompt(product, opts.mat)

    const decor = parseImage(decorInput)
    const artwork = parseImage(artworkInput)

    // Chaîne de modèles : on tente le principal (3.x, meilleure fidélité + sortie 2K), puis on RETOMBE
    // sur un modèle au filtre d'entrée moins strict s'il renvoie une réponse SANS image. Cas typique :
    // une œuvre FIGURATIVE (une personne) que gemini-3.x refuse en entrée, alors que gemini-2.5-flash-image
    // l'accepte. Sans ce filet, l'insertion échouait systématiquement (ex. un poster de footballer).
    const chain = FALLBACK_MODEL && FALLBACK_MODEL !== model ? [model, FALLBACK_MODEL] : [model]

    let outB64: string | null = null
    let outMime = 'image/png'
    let usedModel = model
    let lastDetail = 'inconnu'

    for (const m of chain) {
      const req: any = {
        model: m,
        contents: [
          { text: prompt },
          { inlineData: { mimeType: decor.mimeType, data: decor.data } }, // IMAGE 1 = décor (scène)
          { inlineData: { mimeType: artwork.mimeType, data: artwork.data } }, // IMAGE 2 = oeuvre
        ],
        config: {
          responseModalities: ['IMAGE'],
          imageConfig: imageConfigFor(m), // décor carré -> sortie carrée (2K sur 3.x uniquement)
          safetySettings: SAFETY_SETTINGS, // desserre les filtres configurables
        },
      }

      // Garde-fou timeout (le SDK peut ne pas en exposer) : on borne l'appel sous le TTL job (15 min).
      const rsp: any = await Promise.race([
        this.ai.models.generateContent(req),
        new Promise((_, rej) => setTimeout(() => rej(new Error('Gemini timeout')), 580000)),
      ])

      const parts = rsp?.candidates?.[0]?.content?.parts || []
      for (const part of parts) {
        if (part?.inlineData?.data) {
          outB64 = part.inlineData.data
          outMime = part.inlineData.mimeType || outMime
          usedModel = m
          break
        }
      }
      if (outB64) break
      // Réponse sans image -> refus modération Google ou réponse vide. On journalise la VRAIE raison
      // (blockReason/finishReason/safety/text) puis on tente le modèle suivant de la chaîne.
      lastDetail = describeRefusal(rsp)
      Logger.warn('insert REFUS model=%s product=%s (%s)', m, product, lastDetail)
    }

    if (!outB64) {
      // Tous les modèles ont renvoyé une réponse sans image. L'œuvre s'insère pourtant dans d'autres
      // décors : on guide vers le bon levier (régénérer le décor) et on porte le message jusqu'au front.
      const err: any = new Error(
        `Insertion refusée par la modération du modèle (${lastDetail}). ` +
          'Régénère un nouveau décor puis relance l’insertion.'
      )
      err.userMessage = err.message
      throw err
    }

    if (usedModel !== model) {
      Logger.info('insert FALLBACK %s -> %s (le principal a refusé l’entrée)', model, usedModel)
    }
    Logger.info('insert OK model=%s product=%s mime=%s', usedModel, product, outMime)
    const jpeg = await sharp(Buffer.from(outB64, 'base64'))
      .jpeg({ quality: 92, progressive: true, mozjpeg: true })
      .toBuffer()
    return `data:image/jpeg;base64,${jpeg.toString('base64')}`
  }
}
