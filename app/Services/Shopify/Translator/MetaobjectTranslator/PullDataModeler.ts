import type { MetaobjectToTranslate } from 'Types/Metaobject'
import DefaultPullDataModeler from '../PullDataModeler'

export default class PullDataModeler extends DefaultPullDataModeler {
  public async getResourceOutdatedTranslations() {
    const metaobjectToTranslate = [] as any[]

    // Painting Options
    const { query: paintingOptionsQuery, variables: paintingOptionsVariables } =
      this.getPaintingOptionsMetaobjectsToTranslateQuery()
    const paintingOptionsData = await this.fetchGraphQL(
      paintingOptionsQuery,
      paintingOptionsVariables
    )
    const paintingOptionsMetaobjects = paintingOptionsData.metaobjects.edges as {
      node: MetaobjectToTranslate
    }[]
    metaobjectToTranslate.push(...paintingOptionsMetaobjects.map((metaobject) => metaobject.node))

    // Radio container
    const { query: radioContainerQuery, variables: radioContainerVariables } =
      this.getRadioContainerMetaobjectsToTranslateQuery()
    const radioContainerData = await this.fetchGraphQL(radioContainerQuery, radioContainerVariables)
    const radioContainerMetaobjects = radioContainerData.metaobjects.edges as {
      node: MetaobjectToTranslate
    }[]
    metaobjectToTranslate.push(...radioContainerMetaobjects.map((metaobject) => metaobject.node))

    // Popup title
    const { query: popupQuery, variables: popupVariables } =
      this.getPopupTitleMetaobjectsToTranslateQuery()
    const popupTitleData = await this.fetchGraphQL(popupQuery, popupVariables)
    const popupTitleMetaobjects = popupTitleData.metaobjects.edges as {
      node: MetaobjectToTranslate
    }[]
    metaobjectToTranslate.push(...popupTitleMetaobjects.map((metaobject) => metaobject.node))

    // Popup description
    const { query: popupDescriptionQuery, variables: popupDescriptionVariables } =
      this.getPopupDescriptionMetaobjectsToTranslateQuery()
    const popupDescriptionData = await this.fetchGraphQL(
      popupDescriptionQuery,
      popupDescriptionVariables
    )
    const popupDescriptionMetaobjects = popupDescriptionData.metaobjects.edges as {
      node: MetaobjectToTranslate
    }[]
    metaobjectToTranslate.push(...popupDescriptionMetaobjects.map((metaobject) => metaobject.node))

    // Custom media
    const { query: customMediaQuery, variables: customMediaVariables } =
      this.getCustomMediaMetaobjectsToTranslateQuery()
    const customMediaData = await this.fetchGraphQL(customMediaQuery, customMediaVariables)
    const customMediaMetaobjects = customMediaData.metaobjects.edges as {
      node: MetaobjectToTranslate
    }[]
    metaobjectToTranslate.push(...customMediaMetaobjects.map((metaobject) => metaobject.node))

    // Color patterns
    const { query: colorPatternQuery, variables: colorPatternVariables } =
      this.getColorPatternMetaobjectsToTranslateQuery()
    const colorPatternData = await this.fetchGraphQL(colorPatternQuery, colorPatternVariables)
    const colorPatternMetaobjects = colorPatternData.metaobjects.edges as {
      node: MetaobjectToTranslate
    }[]
    metaobjectToTranslate.push(...colorPatternMetaobjects.map((metaobject) => metaobject.node))

    // Themes
    const { query: themeQuery, variables: themeVariables } =
      this.getThemeMetaobjectsToTranslateQuery()
    const themeData = await this.fetchGraphQL(themeQuery, themeVariables)
    const themeMetaobjects = themeData.metaobjects.edges as {
      node: MetaobjectToTranslate
    }[]
    metaobjectToTranslate.push(...themeMetaobjects.map((metaobject) => metaobject.node))

    return metaobjectToTranslate
  }

  private getPaintingOptionsMetaobjectsToTranslateQuery() {
    return {
      query: `query AllMetaobjects {
                metaobjects(first: 250, type: "painting_option") {
                  edges {
                    node {
                      id
                      displayName
                      type
                      field(key: "name") {
                        key
                        type
                        jsonValue
                      }
                    }
                  }
                }
              }`,
      variables: {},
    }
  }

  private getRadioContainerMetaobjectsToTranslateQuery() {
    return {
      query: `query AllMetaobjects {
                metaobjects(first: 250, type: "radio_container") {
                  edges {
                    node {
                      id
                      displayName
                      type
                      field(key: "title") {
                        key
                        type
                        jsonValue
                      }
                    }
                  }
                }
              }`,
      variables: {},
    }
  }

  private getPopupTitleMetaobjectsToTranslateQuery() {
    return {
      query: `query AllMetaobjects {
                metaobjects(first: 250, type: "popup") {
                  edges {
                    node {
                      id
                      displayName
                      type
                      field(key: "title") {
                        key
                        type
                        jsonValue
                      }
                    }
                  }
                }
              }`,
      variables: {},
    }
  }

  private getPopupDescriptionMetaobjectsToTranslateQuery() {
    return {
      query: `query AllMetaobjects {
                metaobjects(first: 250, type: "popup") {
                  edges {
                    node {
                      id
                      displayName
                      type
                      field(key: "description") {
                        key
                        type
                        jsonValue
                      }
                    }
                  }
                }
              }`,
      variables: {},
    }
  }

  private getCustomMediaMetaobjectsToTranslateQuery() {
    return {
      query: `query AllMetaobjects {
                metaobjects(first: 250, type: "custom_media") {
                  edges {
                    node {
                      id
                      displayName
                      type
                      field(key: "alt") {
                        key
                        type
                        jsonValue
                      }
                    }
                  }
                }
              }`,
      variables: {},
    }
  }

  private getColorPatternMetaobjectsToTranslateQuery() {
    return {
      query: `query AllMetaobjects {
                metaobjects(first: 250, type: "shopify--color-pattern") {
                  edges {
                    node {
                      id
                      displayName
                      type
                      field(key: "label") {
                        key
                        type
                        jsonValue
                      }
                    }
                  }
                }
              }`,
      variables: {},
    }
  }

  private getThemeMetaobjectsToTranslateQuery() {
    return {
      query: `query AllMetaobjects {
                metaobjects(first: 250, type: "shopify--theme") {
                  edges {
                    node {
                      id
                      displayName
                      type
                      field(key: "label") {
                        key
                        type
                        jsonValue
                      }
                    }
                  }
                }
              }`,
      variables: {},
    }
  }
}
