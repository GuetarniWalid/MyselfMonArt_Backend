import { Product, ProductById, ProductByTag } from 'Types/Product'
import Shopify from '..'

export default class ModelCopier {
  public async copyModelDataOnProduct(product: ProductById, model: ProductByTag) {
    await this.deleteProductOptions(product)
    await this.copyModelOptions(product, model)
    await this.copyModelVariants(product, model)
    await this.copyModelMetafields(product, model)
  }

  private async deleteProductOptions(product: ProductById) {
    const shopify = new Shopify()
    await shopify.product.deleteAllOptions(product.id)
  }

  private async copyModelOptions(product: ProductById, model: ProductByTag) {
    const shopify = new Shopify()
    await shopify.product.createOptions(
      product.id,
      model.options.map((option) => ({
        name: option.name,
        values: option.values,
      }))
    )
  }

  private async copyModelVariants(product: ProductById, model: ProductByTag) {
    const shopify = new Shopify()

    const modelVariants = model.variants.nodes
    if (!modelVariants) return

    const variants = modelVariants.map((variant) => ({
      price: variant.price,
      optionValues: variant.selectedOptions.map((option) => ({
        name: option.value,
        optionName: option.name,
      })),
    }))
    const variantsWithoutDuplicates = variants.slice(1)

    await shopify.product.createVariantsBulk(product.id, variantsWithoutDuplicates)
  }

  private async copyModelMetafields(product: ProductById, model: ProductByTag) {
    const shopify = new Shopify()

    for (const metafield of model.paintingOptionsMetafields.nodes) {
      await shopify.metafield.update(
        product.id,
        metafield.namespace,
        metafield.key,
        JSON.stringify(metafield.references.edges.map((edge) => edge.node.id))
      )
    }
  }

  public isModelProduct(product: ProductById | Product): boolean {
    return product.tags.some((tag) =>
      ['portrait model', 'paysage model', 'square model', 'personalized portrait model'].includes(
        tag
      )
    )
  }

  public canProcessPaintingCreate(product: ProductById | Product): boolean {
    if (!product) return false
    if (this.isModelProduct(product)) return false
    if (product.templateSuffix !== 'painting') return false
    if (product.media.nodes.length < 1) return false
    if (!product.media.nodes[1].image) return false
    return true
  }

  public async copyModelDataFromImageRatio(product: ProductById) {
    const image = product.media.nodes[1]?.image
    if (!image) return

    const imageWidth = image.width
    const imageHeight = image.height
    const ratio = imageWidth / imageHeight

    const isPersonalized = product.tags.includes('personnalisé')

    const shopify = new Shopify()
    const tag = shopify.product.getTagByRatio(ratio, isPersonalized)
    const model = await shopify.product.getProductByTag(tag)
    await this.copyModelDataOnProduct(product, model)
  }

  public getTagFromModel(product: ProductById | Product) {
    const tag = product.tags.find((tag) =>
      ['portrait model', 'paysage model', 'square model', 'personalized portrait model'].includes(
        tag
      )
    )
    if (!tag) throw new Error('Model tag not found')

    return tag
  }

  public getTagFromProduct(product: ProductById | Product) {
    const shopify = new Shopify()
    const image = product.media.nodes[1]?.image
    if (!image) {
      console.log(`No image found for product ${product.id}`)
      return null
    }

    const ratio = image.width / image.height
    const isPersonalized = product.tags.includes('personnalisé')
    const tag = shopify.product.getTagByRatio(ratio, isPersonalized)
    return tag
  }
}
