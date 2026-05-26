import Authentication from './Authentication'
import InstagramPoster from './InstagramPoster'
import PostFormatter from './PostFormatter'

export default class Instagram {
  public authentication: Authentication
  public poster: InstagramPoster
  public postFormatter: PostFormatter

  constructor() {
    this.authentication = new Authentication()
    this.poster = new InstagramPoster()
    this.postFormatter = new PostFormatter()
  }
}
