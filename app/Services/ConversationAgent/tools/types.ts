import type Conversation from 'App/Models/Conversation'

export interface ProductCard {
  title: string
  subtitle?: string
  imageUrl?: string
  url: string
  // Real units sold — used to order the carousel best-seller-first regardless
  // of the order the agent lists handles in.
  unitsSold?: number
}

/**
 * Per-request mutable scratch shared across every tool call in one agent run.
 * Lets getProductByQuery stash full card data that presentProducts can later
 * promote into cardsToSend, which the InboxProcessor renders as an Instagram
 * carousel after the text reply.
 */
export interface ToolScratch {
  productsByHandle: Map<string, ProductCard>
  cardsToSend: ProductCard[]
}

export interface ToolContext {
  conversation: Conversation
  scratch: ToolScratch
}

export interface ToolDefinition {
  name: string
  description: string
  input_schema: {
    type: 'object'
    properties: Record<string, any>
    required?: string[]
  }
}

export interface ToolHandler {
  definition: ToolDefinition
  execute(input: any, context: ToolContext): Promise<string>
}
