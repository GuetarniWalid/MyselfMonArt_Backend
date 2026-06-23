import sharp from 'sharp'

// Taille max des aperçus servis au client (plan §5 : 1024 px max, HD jamais avant achat).
// L'aperçu n'est plus tatoué : la résolution bridée est désormais la SEULE protection avant
// paiement — la HD pleine définition reste privée jusqu'à l'achat (cf. Worker.judgeAndStore).
const PREVIEW_MAX_PX = 1024

/**
 * Fabrique l'aperçu client : redimensionne à 1024 px max (fit « inside », sans agrandir) et
 * réencode en JPEG. Aucun watermark.
 *
 * NB : cet aperçu reste produit dans le PROCESS ENFANT du juge (judge-child.js), jamais dans
 * le worker — toute opération sharp/libvips du chemin candidat doit y rester (cause racine du
 * SIGSEGV de l'incident 13-14/06, voir JudgeRunner.ts).
 */
export default class PreviewService {
  public static async makePreview(input: Buffer): Promise<Buffer> {
    return sharp(input)
      .resize(PREVIEW_MAX_PX, PREVIEW_MAX_PX, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 84, progressive: true, mozjpeg: true })
      .toBuffer()
  }
}
