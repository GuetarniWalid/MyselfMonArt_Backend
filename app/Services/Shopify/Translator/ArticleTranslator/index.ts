import Authentication from '../../Authentication'
import PullDataModeler from './PullDataModeler'
import PushDataModeler from './PushDataModeler'

export default class ArticleTranslator extends Authentication {
  public pullDataModeler: PullDataModeler
  public pushDataModeler: PushDataModeler

  constructor() {
    super()
    this.pullDataModeler = new PullDataModeler()
    this.pushDataModeler = new PushDataModeler()
  }
}
