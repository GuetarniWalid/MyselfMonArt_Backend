import type { PinterestPin, PinterestResponse, Board } from 'Types/Pinterest'
import Authentication from './Authentication'

const PAGE_SIZE = 100

export default class PinterestFetcher extends Authentication {
  public async getAllPins() {
    return this.paginate<PinterestPin>('/pins')
  }

  public async getAllBoards() {
    return this.paginate<Board>('/boards')
  }

  public async getAllPublicBoards() {
    const boards = await this.paginate<Board>('/boards')
    return boards.filter((board) => board.privacy === 'PUBLIC')
  }

  private async paginate<T>(url: string): Promise<T[]> {
    const items: T[] = []
    let bookmark: string | undefined
    do {
      const response = (await this.request({
        method: 'GET',
        url,
        params: { page_size: PAGE_SIZE, ...(bookmark ? { bookmark } : {}) },
      })) as PinterestResponse<T>
      items.push(...response.items)
      bookmark = response.bookmark
    } while (bookmark)
    return items
  }
}
