import Env from '@ioc:Adonis/Core/Env'
import Logger from '@ioc:Adonis/Core/Logger'
import OpenAI from 'openai'
import sharp from 'sharp'

type Target = 'portrait' | 'square' | 'landscape'
type Product = 'canvas' | 'poster' | 'tapestry'

export interface DecorOptions {
  roomType?: string // ex: living room, bedroom, kitchen
  product?: Product
  theme?: string // override manuel ; sinon dérivé automatiquement de l'oeuvre
}

// Ratio/orientation pour le prompt + taille image gpt-image-2 EXACTE pour le ratio (multiples de 16,
// validées en generate). La taille pixel prime sur le texte du prompt, donc elle DOIT matcher le ratio
// du cadre cible (3:4 / 1:1 / 4:3) pour que l'insertion de l'oeuvre (étape 2) soit alignée.
const TARGET = {
  portrait: { ratio: '3:4', orientation: 'portrait', size: '1152x1536' },
  square: { ratio: '1:1', orientation: 'square', size: '1024x1024' },
  landscape: { ratio: '4:3', orientation: 'landscape', size: '1536x1152' },
} as const

// Thème de secours si la dérivation vision échoue (toujours un brief déjà "dé-clichéisé").
const FALLBACK_THEME = 'warm neutral European palette, natural oak and linen, matte ceramic accents'

/**
 * Génère un DÉCOR (intérieur réaliste avec une toile/cadre VIDE au bon ratio) via gpt-image-2.
 * L'oeuvre n'est PAS dessinée ici : elle sert seulement à dériver le thème déco + le ratio.
 * L'insertion fidèle de l'oeuvre est une étape ultérieure (Nano Banana).
 */
export default class DecorGenerator {
  private openai: OpenAI
  private imageModel = Env.get('OPENAI_IMAGE_MODEL') || 'gpt-image-2'
  // gpt-4o-2024-08-06 est dans l'env (donc garanti dispo) et gère la vision + max_tokens.
  private visionModel = Env.get('OPENAI_VISION_MODEL') || 'gpt-4o-2024-08-06'
  private quality = Env.get('OPENAI_DECOR_QUALITY') || 'high'

  constructor() {
    this.openai = new OpenAI({ apiKey: Env.get('OPENAI_API_KEY') })
  }

  public async generate(
    artworkInput: string,
    target: Target,
    opts: DecorOptions = {}
  ): Promise<string> {
    const t = TARGET[target]
    if (!t) throw new Error(`Cible invalide: ${target}`)

    const product: Product =
      opts.product === 'poster' ? 'poster' : opts.product === 'tapestry' ? 'tapestry' : 'canvas'
    const roomType = (opts.roomType || 'living room').trim()
    const theme = (opts.theme && opts.theme.trim()) || (await this.deriveTheme(artworkInput))

    const prompt = buildDecorPrompt(t.ratio, t.orientation, roomType, product, theme)

    // gpt-image-2 text-to-image. Params castés en any (types SDK périmés, cf. ArtworkResizer).
    const params: any = {
      model: this.imageModel,
      prompt,
      size: t.size,
      quality: this.quality,
      n: 1,
    }
    const rsp = await this.openai.images.generate(params, { timeout: 580000 })
    const b64 = rsp.data?.[0]?.b64_json
    if (!b64) throw new Error('Réponse vide de gpt-image (décor)')

    const jpeg = await sharp(Buffer.from(b64, 'base64'))
      .jpeg({ quality: 90, progressive: true, mozjpeg: true })
      .toBuffer()
    return `data:image/jpeg;base64,${jpeg.toString('base64')}`
  }

  /**
   * Regarde l'oeuvre et en déduit un BRIEF déco court et raffiné (palette + 1-2 matières),
   * pour accorder le décor au thème de l'oeuvre SANS copier ses motifs ni tomber dans le cliché.
   * Retourne toujours une chaîne exploitable (fallback si l'appel échoue).
   */
  private async deriveTheme(artworkInput: string): Promise<string> {
    const dataUrl = artworkInput.startsWith('data:')
      ? artworkInput
      : `data:image/png;base64,${artworkInput}`
    try {
      const rsp = await this.openai.chat.completions.create(
        {
          model: this.visionModel,
          max_tokens: 60,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: "Look at this artwork. In 3 to 7 words, give a refined INTERIOR-DECOR accent brief to harmonize a high-end European room with it: a color palette (2-3 tones) plus 1-2 natural materials or objects. Translate the artwork's mood into tasteful European decor — do NOT copy its motifs literally, no cultural cliché, no symbols. Output ONLY the brief, lowercase, no preamble, no quotes.",
                },
                { type: 'image_url', image_url: { url: dataUrl } },
              ],
            },
          ],
        } as any,
        { timeout: 60000 }
      )
      const txt = rsp.choices?.[0]?.message?.content?.trim()
      if (txt) {
        // garde une seule ligne courte
        const clean = txt
          .replace(/\s+/g, ' ')
          .replace(/^["']|["']$/g, '')
          .slice(0, 160)
        if (clean.length >= 3) {
          Logger.info('decor theme derived: %s', clean)
          return clean
        }
      }
    } catch (e) {
      Logger.warn('decor theme derive failed (fallback): %s', (e as any)?.message || e)
    }
    return FALLBACK_THEME
  }
}

// ---- Prompt maître (panel multi-agents anti-slop, 2026-06-03) ----
// Intérieur européen contemporain BRANDÉ (anti AI-slop) + accents thématiques discrets,
// avec UNE toile/cadre VIDE plat, de face, au ratio cible, exploitable pour insertion ultérieure.
function buildDecorPrompt(
  ratio: string,
  orientation: string,
  roomType: string,
  product: Product,
  theme: string
): string {
  const productNoun =
    product === 'poster' ? 'framed poster' : product === 'tapestry' ? 'tapestry' : 'canvas'
  const productLine =
    product === 'poster'
      ? 'A slim minimalist matte frame in warm oak or soft black; the blank sheet fills the whole aperture edge-to-edge with NO mat / no passe-partout; non-reflective matte, no glass glare; a thin frame edge gently contrasting the wall so the rectangular opening stays crisply defined.'
      : product === 'tapestry'
        ? 'A soft woven wall tapestry / textile panel hung flat from a slim wooden rod at the top; its face is one uniform, blank, light-grey woven textile with a subtle natural weave but NO pattern; it hangs flat and rectangular against the wall, edges straight; no frame, no glass.'
        : 'A slim gallery-wrapped stretched canvas with clean wrapped side edges and a subtle shallow depth, matte surface, no surrounding frame, no glass, no visible fabric weave, no sheen.'

  return `Photorealistic interior photograph, shot like an editorial spread in a high-end design magazine (in the spirit of Kinfolk / The World of Interiors / Cereal) — a real, lived-in, characterful designer's interior with a strong point of view, NOT a generic empty AI render. The single subject is ONE empty wall ${productNoun}, shown straight-on, perfectly flat, and completely blank inside — it is a blank product mockup waiting to be filled, not a finished art scene.

THE EMPTY ${productNoun} (most important): A brand-new, unprinted ${productNoun} hanging alone on an otherwise bare stretch of wall, centered and at eye level. Front = one single, perfectly uniform, smooth matte surface in soft neutral light-grey (~#ECECEC), evenly and flatly lit edge to edge — this surface stays neutral, flat-lit and shadow-free even though the room around it is directionally lit; nothing depicted on it, no gradient, no glow, no vignette, no cast pattern across it. Perfectly FLAT and planar (no bulge/curve/sag), crisp straight edges, parallel sides, exact 90-degree corners. Focal point: fully visible, with a generous, deliberately bare quiet halo of wall on all four sides; never touching the photo edge, nothing overlapping it or casting onto it.

SHAPE & FRAMING: a ${orientation} rectangle with a ${ratio} proportion, its long and short axes parallel to the image edges, occupying roughly 55-65% of the image height and centered. Shot dead straight-on, camera perpendicular and level, 50-85mm lens, flattened perspective, no wide-angle distortion, no keystone, vertical lines vertical.

PRODUCT: ${productLine}

ROOM — A DESIGNER'S INTERIOR WITH CHARACTER (European FIRST, the theme never overrides): a curated, lived-in, premium contemporary European interior with a clear point of view — a refined ${roomType} in the spirit of a Parisian / Scandinavian-Nordic / Belgian-minimalist / Italian-contemporary creator's home. Minimal and restrained but with a strong editorial identity, NOT a flat empty box. Materials must be tactile and real, with visible grain and honest imperfection: hand-troweled lime plaster or microcement, raw or rift-cut oak, slubby linen, natural stone, matte ceramic, aged brass — never glossy plastic or sterile drywall, never flat builder-beige.

SIGNATURE GESTURE (dare here — exactly ONE bold, branded, tasteful move, harmonised with the theme): commit to a single strong design statement that gives the room a memorable identity, then keep everything else restrained around it — conviction over quantity. Choose ONE of: (a) a colour-drenched, characterful FEATURE WALL behind the piece in a deep sophisticated matte/chalky tone (inky petrol-blue, oxblood, deep forest, plaster terracotta, warm charcoal, soft clay or smoky taupe) gently contrasting and flattering the pale grey ${productNoun}; (b) ONE noble unexpected MATERIAL plane on that wall (fluted/reeded plaster, travertine, lime-wash patina, walnut/burl veneer, a single brushed-brass reveal) used architecturally and quietly; (c) ONE confident architectural gesture framing the wall (a soft contemporary plaster arch or recessed alcove, a slim claustra screen, restrained sculptural molding, an honest exposed beam, a steel-framed crittall partition catching daylight); (d) ONE iconic piece of designer furniture or a sculptural floor object (a bouclé lounge chair, a Noguchi-style lamp, a curved travertine plinth) placed low and to one side. This signature sits BEHIND or BESIDE the empty piece so it frames and flatters it — never on top of it, never louder than it, never near or overlapping it, never cluttered. The wall directly behind the piece stays calm and uncluttered.

LIGHT & ATMOSPHERE (this is what kills the AI look — make it directional and alive): a single readable source of soft natural daylight entering from one side, off-frame (left OR right, not both), grazing the textured walls so the room reads in a gentle light-to-shade gradient with real depth. Soft, living cast shadows fall consistently away from that source; warm and cool neutrals answer each other instead of one dead beige tone. NO flat, even, sourceless studio lighting on the room, NO symmetric double lighting — yet keep the grey ${productNoun} surface itself uniformly flat-lit, even and glare-free, with only a soft honest contact shadow at its edge.

COMPOSITION & STYLING (controlled asymmetry, lived-in, never cluttered): the ${productNoun} stays centered and the undisputed focal point, but the surrounding room is arranged in a relaxed off-center triangle so the space breathes and feels real rather than mirror-symmetric and lifeless. A few deliberate, high-taste props as honest signs of life, placed LOW and to the SIDES — never on the feature wall, never near or overlapping the piece: one sculptural ceramic, a single stem in a hand-thrown vase, a stack of design books, a textured accent. Restraint and negative space are luxuries — curated, breathing, alive, with real human presence implied but no people.

THEME ACCENTS (theme: ${theme}): two or three small, refined accents that evoke the theme through MATERIAL, FORM, TEXTURE and COLOR only — a woven texture, a characteristic clay hue, an organic silhouette — confidently integrated and in dialogue with the signature gesture, placed low and to the sides, never on the wall directly behind the piece. They may be a touch more present and original, but always tasteful and editorial; no literal symbols, no tribal motifs, no flags, no masks-as-decor, no touristy clichés, no kitsch. European architecture stays FIRST; the theme only colors the mood.

Negative: empty soulless room, flat sourceless lighting, beige-on-beige plastic, dead symmetry, generic stock blandness; no people; exactly one ${productNoun}, no second frame, no gallery wall, no mirror, no TV or screen; nothing inside the ${productNoun}; no shadow, gradient or glare on the grey surface; the signature gesture must not touch, overlap or shadow the piece; no text, no signature, no watermark, no logo, no border.`
}
