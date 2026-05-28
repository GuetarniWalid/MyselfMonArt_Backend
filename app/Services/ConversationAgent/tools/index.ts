import type { ToolHandler } from './types'
import getShopPolicy from './getShopPolicy'
import getProductByQuery from './getProductByQuery'
import presentProducts from './presentProducts'
import escalateToHuman from './escalateToHuman'

const tools: ToolHandler[] = [getShopPolicy, getProductByQuery, presentProducts, escalateToHuman]

export const toolRegistry: Map<string, ToolHandler> = new Map(
  tools.map((t) => [t.definition.name, t])
)

export const toolDefinitions = tools.map((t) => t.definition)

export type { ToolHandler, ToolContext, ToolDefinition, ProductCard, ToolScratch } from './types'
