import { ProductById, ProductByTag } from 'Types/Product'
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
}
