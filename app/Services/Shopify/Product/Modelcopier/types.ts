export interface DiffResult {
  optionsDiff: OptionsDiff
  variantsDiff: VariantsDiff
  metafieldsDiff?: MetafieldsDiff // Painting-specific metafields (painting_options namespace)
  bundleMetafieldDiff?: BundleMetafieldDiff // Bundle.products metafield (shared across all products)
  categoryDiff?: CategoryDiff // Product category (subclass-specific)
  hasAnyChanges: boolean
}

export interface OptionsDiff {
  needsUpdate: boolean
  hasStructuralChanges: boolean // true if options added/removed (need full recreation)
  optionsToCreate: Array<{ name: string; values: string[] }>
  optionsToDelete: string[] // option IDs
  optionValuesToUpdate: Record<
    string,
    {
      finalValues: string[] // Complete ordered list from model (source of truth)
      currentValues: string[] // Current values in product (for comparison/logging)
      valuesToAdd: string[] // For logging purposes
      valuesToRemove: string[] // For logging purposes
    }
  > // optionId -> complete final state with model's ordering
}

export interface VariantsDiff {
  needsUpdate: boolean
  variantsToUpdate: Array<{
    id: string
    price: string
    inventoryPolicy?: 'DENY' | 'CONTINUE' // Preserve existing inventory policy
  }>
  variantsToDelete: string[] // variant IDs
  variantsToCreate: Array<{
    price: string
    optionValues: Array<{ name: string; optionName: string }>
    inventoryPolicy?: 'DENY' | 'CONTINUE' // Inherit from model variant
  }>
}

export interface MetafieldsDiff {
  needsUpdate: boolean
  metafieldsToUpdate: Array<{
    namespace: string
    key: string
    value: string
  }>
  metafieldsToDelete: Array<{
    namespace: string
    key: string
  }>
}

export interface BundleMetafieldDiff {
  needsUpdate: boolean
  productReferences: string[] // Product IDs from model (source of truth)
}

export interface CategoryDiff {
  needsUpdate: boolean
  categoryGid: string // Category GID to set (e.g., "gid://shopify/TaxonomyCategory/hg-3-4-2")
}
