import Variants from 'App/Models/Variants'
import type { Ratio } from 'Types/Product'
import type {
  PaintingJson,
  PaintingVariantsWithChildren,
  PaintingVariantsWithChildrenChildren,
  PaintingVariantsWithoutChildren,
} from 'Types/Variant'

export default class SearchPaintingData {
  private size: string
  private matter: string
  private otherOptions: string[]

  constructor(
    private ratio: Ratio,
    options: string[]
  ) {
    this.size = options[0]
    this.matter = options[1]
    this.otherOptions = options.slice(2)
  }

  private async getVariantsByRatio(): Promise<PaintingJson> {
    const variants = await Variants.findVariantsByRatio(this.ratio)
    return variants
  }

  private getVariantsBySize(variants: PaintingJson) {
    const variantsBySizeList = variants.filter((variant) => variant.name === this.size)
    return variantsBySizeList[0]
  }

  private getVariantsByMatter(variantsBySize: PaintingVariantsWithChildrenChildren) {
    const matters = variantsBySize.children
    return matters.find((matter) => matter.name === this.matter) as PaintingVariantsWithChildren
  }

  private getSizePrice(variantsBySize: PaintingVariantsWithChildrenChildren) {
    return variantsBySize.price
  }

  private getMatterPrice(variantsByMatter: PaintingVariantsWithChildren) {
    return variantsByMatter.price
  }

  private getOtherOptions(variantsByMatter: PaintingVariantsWithChildren) {
    const otherVariantsList = variantsByMatter.children
    return otherVariantsList.map((otherVariants, index) => {
      return this.getOption(otherVariants, index)
    })
  }

  private getOption(otherVariants: PaintingVariantsWithoutChildren[], index: number) {
    const option = otherVariants.find(
      (otherVariant) => otherVariant.name === this.otherOptions[index]
    ) as PaintingVariantsWithoutChildren
    return option
  }

  private getOtherOptionsPrice(otherOptions: PaintingVariantsWithoutChildren[]) {
    return otherOptions.reduce((acc, otherOption) => {
      return acc + otherOption.price
    }, 0)
  }

  public async getPaintingPrice() {
    const variantsByRatio = await this.getVariantsByRatio()
    const variantsBySize = this.getVariantsBySize(variantsByRatio)
    const variantsByMatter = this.getVariantsByMatter(variantsBySize)
    const otherOptions = this.getOtherOptions(variantsByMatter)
    const totalPrice =
      this.getSizePrice(variantsBySize) +
      this.getMatterPrice(variantsByMatter) +
      this.getOtherOptionsPrice(otherOptions)

    return totalPrice.toString()
  }
}
