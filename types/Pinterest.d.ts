export interface PinterestBoardOwner {
  username: string
  full_name: string
  id: string
}

/**
 * Une diapositive telle que Pinterest la renvoie sur GET /v5/pins/{id} pour un
 * pin `multiple_images`. `title` / `description` / `link` sont nullables : ce
 * sont EUX que l'interface Pinterest affiche sur un carrousel, d'où le
 * rattrapage `pinterest:backfill_carousel_titles` quand ils sont vides.
 */
export interface PinterestMediaItem {
  item_type: string
  title: string | null
  description: string | null
  link: string | null
}

export interface PinterestMedia {
  type: string
  url: string
  width: number
  height: number
  /** 'image' | 'video' | 'multiple_images' | 'multiple_videos' */
  media_type?: string
  items?: PinterestMediaItem[]
}

/**
 * Métriques d'un pin, renvoyées par `GET /v5/pins/{id}?pin_metrics=true`.
 * `impression` = vues, `reaction` = « j'aime ». Les métriques « lifetime » ne
 * sont pas garanties sur un pin antérieur au 2023-03-20 (hors vidéo/Idea), d'où
 * le repli sur la fenêtre 90 jours.
 */
export interface PinterestPinMetricValues {
  impression?: number
  reaction?: number
  save?: number
  pin_click?: number
  clickthrough?: number
  comment?: number
}

export interface PinterestPinMetrics {
  '90d'?: PinterestPinMetricValues
  'lifetime_metrics'?: PinterestPinMetricValues
}

export interface PinterestPin {
  alt_text: string
  is_removable: boolean
  creative_type: 'REGULAR' | string
  board_owner: PinterestBoardOwner
  link: string
  pin_metrics: PinterestPinMetrics | null
  is_owner: boolean
  title: string
  board_id: string
  product_tags: string[]
  created_at: string
  media: PinterestMedia
  id: string
  board_section_id: string | null
  description: string
  dominant_color: string
  is_standard: boolean
  parent_pin_id: string | null
  has_been_promoted: boolean
  note: string
}

export interface PinterestResponse<T> {
  items: T[]
  bookmark?: string
  page_size?: number
}

export interface Board {
  id: string
  name: string
  description?: string
  privacy: 'PUBLIC' | 'PROTECTED' | 'SECRET'
  created_at: string
  board_pins_modified_at: string
  pin_count: number
  follower_count: number
  collaborator_count: number
  is_ads_only: boolean
  owner: {
    username: string
  }
  media: {
    pin_thumbnail_urls: string[]
    image_cover_url: string | null
  }
}

export type PinterestPinFormat = 'image' | 'video' | 'carousel'

export type PinContentType = 'image/png' | 'image/jpeg'

/** Common fields shared by every pin variant, regardless of media source. */
export interface PinPayloadBase {
  board_id: string
  title: string
  description: string
  link: string
  alt_text: string
}

/** Single static image pin (base64 upload). */
export interface ImagePinPayload extends PinPayloadBase {
  media_source: {
    source_type: 'image_base64'
    content_type: PinContentType
    data: string
  }
}

/** Video pin — references a media upload already registered + processed. */
export interface VideoPinPayload extends PinPayloadBase {
  media_source: {
    source_type: 'video_id'
    media_id: string
    cover_image_content_type: PinContentType
    cover_image_data: string
  }
}

/**
 * Une diapositive de carrousel. Pinterest affiche le titre/la description
 * PORTÉS PAR LA DIAPOSITIVE, pas ceux du pin : sans ces champs le carrousel
 * s'affiche sans aucun titre, alors même que le pin en a un.
 * cf. `media_source.items[]` de POST /v5/pins et `carousel_slots` de PATCH.
 */
export interface CarouselSlot {
  title?: string
  description?: string
  link?: string
}

/** Carousel pin — 2 to 5 base64 images sharing the same aspect ratio. */
export interface CarouselPinPayload extends PinPayloadBase {
  media_source: {
    source_type: 'multiple_image_base64'
    items: Array<
      CarouselSlot & {
        content_type: PinContentType
        data: string
      }
    >
  }
}

/** Corps accepté par PATCH /v5/pins/{pin_id} (mise à jour d'un pin existant). */
export interface PinUpdatePayload {
  title?: string
  description?: string
  alt_text?: string
  link?: string
  carousel_slots?: CarouselSlot[]
}

export type PinPayload = ImagePinPayload | VideoPinPayload | CarouselPinPayload

/** Response of POST /v5/media (register a media upload). */
export interface MediaUploadRegistration {
  media_id: string
  media_type: 'video'
  upload_url: string
  upload_parameters: Record<string, string>
}

export type MediaUploadStatus = 'registered' | 'processing' | 'succeeded' | 'failed'

/** Response of GET /v5/media/{media_id}. */
export interface MediaUpload {
  media_id: string
  media_type: 'video'
  status: MediaUploadStatus
}
