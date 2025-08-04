import { Product, ProductById, ProductByTag } from 'Types/Product'
import Shopify from '../..'
import ChatGPT from 'App/Services/ChatGPT'
import { LanguageCode, RegionCode } from 'Types/Translation'

export default abstract class ModelCopier {
  public abstract isModelProduct(product: ProductById | Product): boolean
  public abstract canProcessProductCreate(product: ProductById | Product): boolean
  public abstract getTagFromModel(product: ProductById | Product): string
  public abstract getTagFromProduct(product: ProductById | Product): string | null

  protected async deleteProductOptions(product: ProductById) {
    const shopify = new Shopify()
    await shopify.product.deleteAllOptions(product.id)
  }

  protected async copyModelOptions(product: ProductById, model: ProductByTag) {
    const shopify = new Shopify()
    await shopify.product.createOptions(
      product.id,
      model.options.map((option) => ({
        name: option.name,
        values: option.values,
      }))
    )
  }

  protected async copyModelVariants(product: ProductById, model: ProductByTag) {
    const shopify = new Shopify()

    const modelVariants = model.variants.nodes
    if (!modelVariants) return

    const defaultVariant = product.variants.nodes[0]
    const variants = modelVariants.map((variant) => ({
      price: variant.price,
      optionValues: variant.selectedOptions.map((option) => ({
        name: option.value,
        optionName: option.name,
      })),
    }))

    const [defaultModelVariant, ...variantsWithoutDefault] = variants
    await shopify.product.updateVariant(product.id, defaultVariant.id, {
      price: defaultModelVariant.price,
    })
    await shopify.product.createVariantsBulk(product.id, variantsWithoutDefault)
  }

  protected async translateProductOptionsInAllLanguages(product: ProductById) {
    await this.translateProductOptions(product, 'en')
    await this.translateProductOptions(product, 'en', 'UK')
  }

  private async translateProductOptions(
    product: ProductById,
    locale: LanguageCode,
    region?: RegionCode
  ) {
    console.info(
      `🚀 Translating product options: ${product.id} to ${locale}${region ? `-${region}` : ''}`
    )
    const shopify = new Shopify()
    const chatGPT = new ChatGPT()

    const updatedProduct = await shopify.product.getProductById(product.id)

    const productToTranslate = {
      id: updatedProduct.id,
      options: updatedProduct.options.map((option) => ({
        id: option.id,
        name: option.name,
        optionValues: option.optionValues.map((value) => ({
          id: value.id,
          name: value.name,
        })),
      })),
    }

    const productTranslated = await chatGPT.translate(productToTranslate, 'product', locale, region)

    const responses = await shopify.translator('product').updateTranslation({
      resourceToTranslate: productToTranslate,
      resourceTranslated: productTranslated,
      isoCode: locale,
      region,
    })

    responses.forEach((response) => {
      if (response.translationsRegister.userErrors.length > 0) {
        console.log('🚨 Error => ', response.translationsRegister.userErrors)
      } else {
        console.log('✅ Translation updated')
      }
    })
  }

  public areOptionsSimilar(product: ProductById, model: ProductByTag): boolean {
    if (!product.options || !model.options) return false
    if (product.options.length !== model.options.length) return false

    return product.options.every((productOption, index) => {
      const modelOption = model.options[index]

      if (productOption.name !== modelOption.name) return false
      if (productOption.optionValues.length !== modelOption.values.length) return false

      return productOption.optionValues.every((value) => modelOption.values.includes(value.name))
    })
  }

  public areVariantsSimilar(product: ProductById, model: ProductByTag): boolean {
    if (!product.variants?.nodes || !model.variants?.nodes) return false
    if (product.variants.nodes.length !== model.variants.nodes.length) return false

    return product.variants.nodes.every((productVariant) => {
      const matchingModelVariant = model.variants.nodes.find((modelVariant) => {
        if (productVariant.price !== modelVariant.price) return false

        const optionsMatch = productVariant.selectedOptions.every((productOption) => {
          const hasMatchingOption = modelVariant.selectedOptions.some(
            (modelOption) =>
              modelOption.name === productOption.name && modelOption.value === productOption.value
          )
          if (!hasMatchingOption) return false
          return hasMatchingOption
        })

        return optionsMatch
      })

      return !!matchingModelVariant
    })
  }
}
