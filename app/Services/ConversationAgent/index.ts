import Env from '@ioc:Adonis/Core/Env'
import Authentication from '../Claude/Authentication'
import buildSystemPrompt from './prompts/system'
import {
  toolDefinitions,
  toolRegistry,
  ToolHandler,
  ProductCard,
  ToolScratch,
  CtaButton,
} from './tools'
import type Conversation from 'App/Models/Conversation'
import type ConversationMessage from 'App/Models/ConversationMessage'

interface AgentResult {
  replyText: string | null
  escalated: boolean
  toolCalls: Array<{ name: string; input: any; output: string }>
  cards: ProductCard[]
  cta: CtaButton | null
  tokensIn: number
  tokensOut: number
}

interface ClaudeMessage {
  role: 'user' | 'assistant'
  content: any
}

const MAX_ITERATIONS = 8
const HISTORY_TURNS = 12 // last 12 stored messages = ~6 exchanges of context

export default class ConversationAgent extends Authentication {
  /**
   * Drive the agentic tool-use loop and return the final reply text (or null
   * if Claude produced nothing usable). The conversation passed in must be
   * persisted and reloaded after `respond()` since tools can mutate it
   * (e.g. escalateToHuman flips status).
   */
  public async respond(
    conversation: Conversation,
    incomingUserText: string,
    history: ConversationMessage[]
  ): Promise<AgentResult> {
    const messages: ClaudeMessage[] = this.buildHistory(history, incomingUserText)
    const toolCallsLog: AgentResult['toolCalls'] = []
    const scratch: ToolScratch = { productsByHandle: new Map(), cardsToSend: [] }
    let tokensIn = 0
    let tokensOut = 0

    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      // On the final allowed iteration, force a text answer with
      // tool_choice:none. We keep `tools` DEFINED (not omitted) because the
      // message history already contains tool_use/tool_result blocks — omitting
      // tools then makes the API return an empty response. tool_choice:none
      // forbids new tool calls while keeping the schema valid.
      const isFinalIteration = iteration === MAX_ITERATIONS - 1
      const response = await this.anthropic.messages.create({
        model: Env.get('CLAUDE_MODEL'),
        max_tokens: 2048,
        system: buildSystemPrompt(),
        tools: toolDefinitions as any,
        ...(isFinalIteration ? { tool_choice: { type: 'none' as const } } : {}),
        messages: messages as any,
      })

      tokensIn += response.usage?.input_tokens ?? 0
      tokensOut += response.usage?.output_tokens ?? 0

      const assistantContent = response.content

      if (response.stop_reason !== 'tool_use') {
        const text = this.extractText(assistantContent)
        return {
          replyText: text,
          escalated: conversation.status === 'escalated',
          toolCalls: toolCallsLog,
          cards: scratch.cardsToSend,
          cta: scratch.cta ?? null,
          tokensIn,
          tokensOut,
        }
      }

      // tool_use round: append assistant message, execute tools, append tool results
      messages.push({ role: 'assistant', content: assistantContent })

      const toolResults: any[] = []
      for (const block of assistantContent) {
        if (block.type !== 'tool_use') continue
        const handler: ToolHandler | undefined = toolRegistry.get(block.name)
        let output: string
        if (!handler) {
          output = JSON.stringify({ error: `Unknown tool: ${block.name}` })
        } else {
          try {
            output = await handler.execute(block.input, { conversation, scratch })
          } catch (err: any) {
            output = JSON.stringify({ error: err?.message ?? 'tool execution failed' })
          }
        }
        toolCallsLog.push({ name: block.name, input: block.input, output })
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: output,
        })
      }
      messages.push({ role: 'user', content: toolResults })
    }

    // Loop ran out of iterations — bail with whatever we have
    console.warn(`⚠️  ConversationAgent reached MAX_ITERATIONS=${MAX_ITERATIONS} without end_turn`)
    return {
      replyText: null,
      escalated: conversation.status === 'escalated',
      toolCalls: toolCallsLog,
      cards: scratch.cardsToSend,
      cta: scratch.cta ?? null,
      tokensIn,
      tokensOut,
    }
  }

  private buildHistory(history: ConversationMessage[], incomingUserText: string): ClaudeMessage[] {
    const out: ClaudeMessage[] = []
    const trimmed = history.slice(-HISTORY_TURNS)
    for (const msg of trimmed) {
      if (msg.role === 'user' && msg.content) {
        out.push({ role: 'user', content: msg.content })
      } else if (msg.role === 'assistant' && msg.content) {
        out.push({ role: 'assistant', content: msg.content })
      }
      // tool messages are not replayed — Claude doesn't need historical tool
      // exchanges, only the human-visible turn-by-turn text matters
    }
    out.push({ role: 'user', content: incomingUserText })
    return out
  }

  private extractText(content: any[]): string | null {
    const texts: string[] = []
    for (const block of content) {
      if (block.type === 'text' && typeof block.text === 'string') {
        texts.push(block.text)
      }
    }
    const joined = texts.join('\n').trim()
    return joined.length > 0 ? joined : null
  }
}
