import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import type { BacklinksAnalyseResult } from 'Types/Backlink'
import Backlink from 'App/Models/Backlink'
import { CheerioCrawler } from 'crawlee'
import { CheerioAPI, Element } from 'cheerio'

export default class BacklinksController {
  public async index() {
    const backlinks = await Backlink.all()
    return backlinks
  }

  public async delete({ request }: HttpContextContract) {
    const { url } = request.body()
    const backlink = await Backlink.findBy('url', url)
    await backlink?.delete()
  }

  public async checkLinks(request: HttpContextContract | { urls: string[] }) {
    let urls: string[]
    if ('urls' in request) {
      urls = request.urls
    } else {
      urls = request.request.body().urls
    }

    if (!urls || urls.length === 0) {
      console.log('🚀 ~ No urls to check at : ', new Date())
      return
    }

    if (!Array.isArray(urls) || !urls.every((url) => this.isValidUrl(url))) {
      throw new Error('Bad urls: at least one url is empty or not a string')
    }
    await this.analyseLinksOnSite(urls)
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }

  private async analyseLinksOnSite(urls: string[]) {
    const backlinksAnalyseResult = [] as BacklinksAnalyseResult[]

    const crawler = new CheerioCrawler({
      requestHandler: async ({ $, request }) => {
        const links = this.getLinksOnPage('myselfmonart.com', $)
        if (!links.length) {
          backlinksAnalyseResult.push({
            url: request.url,
            site: this.getDomainFromUrl(request.url),
            anchor: null,
            state: false,
          })
        } else {
          backlinksAnalyseResult.push({
            url: request.url,
            site: this.getDomainFromUrl(request.url),
            anchor: this.getAnchor($, links),
            state: true,
          })
        }
      },
    })

    await crawler.run(urls)
    await this.saveAnalyseLinksResult(backlinksAnalyseResult)
  }

  private getLinksOnPage(domain: string, $: CheerioAPI) {
    const links = $('a[href]')
    return links.toArray().filter((element) => {
      const href = $(element).attr('href')
      return href && href.includes(domain)
    })
  }

  private getDomainFromUrl(url) {
    try {
      let parsedUrl = new URL(url)
      return parsedUrl.hostname
    } catch (e) {
      return null
    }
  }

  private getAnchor($: CheerioAPI, links: Element[]) {
    const domainName = links.find((link) => {
      const textContent = $(link).text().trim()
      return textContent !== ''
    })

    return domainName ? $(domainName).text().trim() : null
  }

  private async saveAnalyseLinksResult(backlinksAnalyseResult: BacklinksAnalyseResult[]) {
    await Backlink.createMany(backlinksAnalyseResult)
  }
}
