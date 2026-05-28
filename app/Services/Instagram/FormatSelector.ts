import type { InstagramPostFormat } from 'Types/Instagram'

/**
 * Picks the format for the next Instagram post using a weighted fixed cycle.
 *
 * Why a cycle and not "best asset wins": once every product has a video, an
 * asset-priority rule (video → reel) would post Reels forever and never vary.
 * Instagram ranks Feed, Reels and Explore on separate algorithms, so a *mix*
 * of formats reaches more surfaces than any single format. The 7-slot pattern
 * below yields 3 Reels / 2 carousels / 2 images per cycle — roughly the
 * home-decor mix the research points to (Reels for reach, carousels for
 * saves/time-spent, images for cadence).
 *
 * The product's actual capabilities are only a *constraint*: if the cycle asks
 * for a format the selected product can't produce, we fall back to the best
 * available one (reach order: reel > carousel > image). With a video + several
 * images on every product, the fallback almost never fires.
 */
export default class FormatSelector {
  private static readonly PATTERN: InstagramPostFormat[] = [
    'reel',
    'carousel',
    'reel',
    'image',
    'carousel',
    'reel',
    'image',
  ]

  // Meta allows 2–10 carousel slides; below 2 a carousel is impossible.
  public static readonly MIN_CAROUSEL_IMAGES = 2

  /**
   * @param priorPostCount    number of IG posts already published (drives the
   *                          deterministic cycle position)
   * @param hasVideo          the product has a public video URL (reel-capable)
   * @param carouselSlideCount number of carousel-eligible images (index 2+; the
   *                          first two product images are excluded from carousels)
   */
  public select(input: {
    priorPostCount: number
    hasVideo: boolean
    carouselSlideCount: number
  }): InstagramPostFormat {
    const { priorPostCount, hasVideo, carouselSlideCount } = input

    const can: Record<InstagramPostFormat, boolean> = {
      reel: hasVideo,
      carousel: carouselSlideCount >= FormatSelector.MIN_CAROUSEL_IMAGES,
      // A product only reaches here after PublicationSelector confirmed a
      // publishable image, so a single-image post is always possible.
      image: true,
    }

    const pattern = FormatSelector.PATTERN
    const desired = pattern[((priorPostCount % pattern.length) + pattern.length) % pattern.length]
    if (can[desired]) return desired

    // Fallback in descending reach order.
    const fallbackOrder: InstagramPostFormat[] = ['reel', 'carousel', 'image']
    return fallbackOrder.find((format) => can[format]) ?? 'image'
  }
}
