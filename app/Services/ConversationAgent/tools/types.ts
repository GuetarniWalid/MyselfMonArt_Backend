import type Conversation from 'App/Models/Conversation'

export interface ToolDefinition {
  name: string
  description: string
  input_schema: {
    type: 'object'
    properties: Record<string, any>
    required?: string[]
  }
}

export interface ToolContext {
  conversation: Conversation
}

export interface ToolHandler {
  definition: ToolDefinition
  execute(input: any, context: ToolContext): Promise<string>
}
