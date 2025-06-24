export interface PinterestBoardOwner {
  username: string
  full_name: string
  id: string
}

export interface PinterestMedia {
  type: string
  url: string
  width: number
  height: number
}

export interface PinterestPin {
  alt_text: string
  is_removable: boolean
  creative_type: 'REGULAR' | string
  board_owner: PinterestBoardOwner
  link: string
  pin_metrics: any | null
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

export interface PinPayload {
  board_id: string
  title: string
  description: string
  link: string
  alt_text: string
  media_source: {
    url: string
    source_type: 'image_url'
  }
}
