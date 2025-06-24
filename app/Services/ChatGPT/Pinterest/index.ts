import PinterestPinAI from './PinterestPinAI'
import PinterestBoardAI from './PinterestBoardAI'

export default class Pinterest {
  public readonly boardAI: PinterestBoardAI
  public readonly pinAI: PinterestPinAI

  constructor() {
    this.boardAI = new PinterestBoardAI()
    this.pinAI = new PinterestPinAI()
  }
}
