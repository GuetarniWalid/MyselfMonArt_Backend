import Authentication from './Authentication'

export default class Google {
  public authentication: Authentication

  constructor() {
    this.authentication = new Authentication()
  }
}
