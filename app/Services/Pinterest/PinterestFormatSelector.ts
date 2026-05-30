import type { PinterestPinFormat } from 'Types/Pinterest'

/**
 * Picks the format for the next Pinterest pin using a weighted fixed cycle —
 * the Pinterest counterpart of Instagram's FormatSelector.
 *
 * Why a cycle and not "best asset wins": with a video on most products an
 * asset-priority rule would post videos far more than the data supports.
 * Research on 1M+ Pins (Tailwind 2025) shows the viral mix is ~89% static
 * image / ~8% video / ~2% collage; video carries higher engagement *per pin*
 * but should stay a minority of the volume. The 8-slot pattern below yields
 * 7 images / 1 video per cycle (~12% video), keeping the static image as the
 * backbone while regularly surfacing video.
 *
 * The product's actual capabilities are only a *constraint*: if the cycle asks
 * for a video but the product has none, we fall back to the best available
 * format (reach order: video > carousel > image), exactly like Instagram.
 * Carousel never appears in the cycle itself — it only exists as a richer
 * fallback when a video slot lands on a product without a video.
 */
export default class PinterestFormatSelector {
  private static readonly PATTERN: PinterestPinFormat[] = [
    'image',
    'image',
    'image',
    'video',
    'image',
    'image',
    'image',
    'image',
  ]

  // Pinterest carousels accept 2–5 images; below 2 a carousel is impossible.
  public static readonly MIN_CAROUSEL_IMAGES = 2

  /**
   * @param priorPostCount     number of pins already published to Pinterest
   *                           (drives the deterministic cycle position)
   * @param hasVideo           the product has a public video URL (video-capable)
   * @param carouselSlideCount number of carousel-eligible images (index 2+; the
   *                           first two product images are excluded from carousels)
   */
  public select(input: {
    priorPostCount: number
    hasVideo: boolean
    carouselSlideCount: number
  }): PinterestPinFormat {
    const { priorPostCount, hasVideo, carouselSlideCount } = input

    const can: Record<PinterestPinFormat, boolean> = {
      video: hasVideo,
      carousel: carouselSlideCount >= PinterestFormatSelector.MIN_CAROUSEL_IMAGES,
      // A product only reaches here after PublicationSelector confirmed a
      // publishable image, so a single-image pin is always possible.
      image: true,
    }

    const pattern = PinterestFormatSelector.PATTERN
    const desired = pattern[((priorPostCount % pattern.length) + pattern.length) % pattern.length]
    if (can[desired]) return desired

    // Fallback in descending reach order: video → carousel → image.
    const fallbackOrder: PinterestPinFormat[] = ['video', 'carousel', 'image']
    return fallbackOrder.find((format) => can[format]) ?? 'image'
  }
}
