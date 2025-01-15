declare type Variant = {
  title: string
  price?: string
}

declare type PaintingVariantsWithoutChildren = {
  name: string
  price: number
  technicalName: string | number
  technicalType: string
}

declare type PaintingVariantsWithChildrenChildren = {
  name: string
  price: number
  children: PaintingVariantsWithChildren[]
  technicalName: string
  technicalType: string
}

declare type PaintingJson = PaintingVariantsWithChildrenChildren[]

declare type PaintingVariantsWithChildren = {
  name: string
  price: number
  children: PaintingVariantsWithoutChildren[][]
  technicalName: string
  technicalType: string
}
