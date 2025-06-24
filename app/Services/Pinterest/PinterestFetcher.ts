import type { PinterestPin, PinterestResponse, Board } from 'Types/Pinterest'
import Authentication from './Authentication'

export default class PinterestFetcher extends Authentication {
  public async getAllPins() {
    const response = (await this.request({
      method: 'GET',
      url: '/pins',
    })) as PinterestResponse<PinterestPin>
    return response.items
  }

  public async getAllBoards() {
    const response = (await this.request({
      method: 'GET',
      url: '/boards',
    })) as PinterestResponse<Board>
    return response.items
  }

  public async getAllPublicBoards() {
    const response = (await this.request({
      method: 'GET',
      url: '/boards',
    })) as PinterestResponse<Board>
    return response.items.filter((board) => board.privacy === 'PUBLIC')
  }
}
