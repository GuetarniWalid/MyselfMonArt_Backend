export type Variant = {
  title: string
  price?: string
}

export type PaintingVariantsWithoutChildren = {
  name: string
  price: number
  technicalName: string | number
  technicalType: string
}

export type PaintingVariantsWithChildrenChildren = {
  name: string
  price: number
  children: PaintingVariantsWithChildren[]
  technicalName: string
  technicalType: string
}

export type PaintingJson = PaintingVariantsWithChildrenChildren[]

export type PaintingVariantsWithChildren = {
  name: string
  price: number
  children: PaintingVariantsWithoutChildren[][]
  technicalName: string
  technicalType: string
}
