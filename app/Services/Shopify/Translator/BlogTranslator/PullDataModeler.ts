import type { BlogToTranslate, BlogWithOutdatedTranslations } from 'Types/Blog'
import type { LanguageCode } from 'Types/Translation'
import DefaultPullDataModeler from '../PullDataModeler'

export default class PullDataModeler extends DefaultPullDataModeler {
  public async getResourceOutdatedTranslations(locale: LanguageCode = 'en') {
    const blogToTranslate = [] as Partial<BlogToTranslate>[]
    let cursor: string | null = null
    let hasNextPage = true

    while (hasNextPage) {
      // Get blogs with outdated translations without metaobject translations
      const { query, variables } = this.getBlogsWithOutdatedTranslationsQuery(cursor, locale)
      const blogsData = await this.fetchGraphQL(query, variables)
      const blogs = blogsData.blogs.edges as {
        node: BlogWithOutdatedTranslations
        cursor: string
      }[]

      for (const blog of blogs) {
        const blogWithOnlyKeyToTranslate = this.getBlogWithOnlyKeyToTranslate(blog.node)
        if (blogWithOnlyKeyToTranslate) {
          blogToTranslate.push(blogWithOnlyKeyToTranslate)
        }
      }

      hasNextPage = blogsData.blogs.pageInfo.hasNextPage
      if (hasNextPage) {
        cursor = blogs[blogs.length - 1].cursor
      }
    }

    return blogToTranslate
  }

  private getBlogsWithOutdatedTranslationsQuery(
    cursor: string | null = null,
    locale: LanguageCode = 'en'
  ) {
    return {
      query: `query AllBlogs($cursor: String) {
                blogs(first: 250, after: $cursor) {
                  edges {
                    node {
                      id
                      title
                      handle
                      translations(locale: "${locale}") {
                        key
                        locale
                        value
                        outdated
                        updatedAt
                      }                      
                    }
                    cursor
                  }
                  pageInfo {
                    hasNextPage
                  }
                }
              }`,
      variables: { cursor },
    }
  }

  public getBlogWithOnlyKeyToTranslate(blog: BlogWithOutdatedTranslations) {
    const { translations, ...blogWithoutTranslations } = blog

    const mutableBlog = blogWithoutTranslations as {
      [key: string]: any
    }

    translations.forEach((translation) => {
      const key = this.getKeyFromTranslationKey(translation.key)
      if (!translation.outdated) {
        delete mutableBlog[key]
      }
    })

    const cleanedBlog = this.cleanResourceEmptyFields({ ...mutableBlog })
    return cleanedBlog
  }

  private getKeyFromTranslationKey(key: string) {
    return key
  }
}
