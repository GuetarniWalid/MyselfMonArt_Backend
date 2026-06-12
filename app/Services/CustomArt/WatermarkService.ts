import sharp from 'sharp'

// Taille max des previews côté client (plan §5 : 1024 px max + watermark, HD jamais avant achat)
const PREVIEW_MAX_PX = 1024
const WATERMARK_TEXT = 'MyselfMonArt'

/**
 * Fabrique la preview client : resize 1024 px max + watermark texte diagonal
 * semi-transparent répété (discret mais présent sur toute la surface).
 */
export default class WatermarkService {
  public static async makePreview(input: Buffer): Promise<Buffer> {
    const resized = await sharp(input)
      .resize(PREVIEW_MAX_PX, PREVIEW_MAX_PX, { fit: 'inside', withoutEnlargement: true })
      .toBuffer()

    const meta = await sharp(resized).metadata()
    const width = meta.width || PREVIEW_MAX_PX
    const height = meta.height || PREVIEW_MAX_PX

    const overlay = Buffer.from(WatermarkService.buildOverlaySvg(width, height))

    return sharp(resized)
      .composite([{ input: overlay, top: 0, left: 0 }])
      .jpeg({ quality: 84, progressive: true, mozjpeg: true })
      .toBuffer()
  }

  /**
   * SVG plein cadre : texte répété en diagonale (-30°), blanc semi-transparent avec
   * un très léger liseré sombre pour rester lisible sur fonds clairs ET foncés.
   */
  private static buildOverlaySvg(width: number, height: number): string {
    const fontSize = Math.round(Math.max(width, height) / 14)
    const stepY = fontSize * 4
    const stepX = fontSize * 7

    const texts: string[] = []
    for (let y = -height; y < height * 2; y += stepY) {
      for (let x = -width; x < width * 2; x += stepX) {
        texts.push(
          `<text x="${x}" y="${y}" font-size="${fontSize}" ` +
            `font-family="Arial, Helvetica, sans-serif" font-weight="bold" ` +
            `fill="rgba(255,255,255,0.16)" stroke="rgba(0,0,0,0.08)" stroke-width="1">` +
            `${WATERMARK_TEXT}</text>`
        )
      }
    }

    return (
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
      `<g transform="rotate(-30 ${width / 2} ${height / 2})">${texts.join('')}</g>` +
      `</svg>`
    )
  }
}
