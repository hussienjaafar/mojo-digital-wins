/**
 * Shared Lovable AI Gateway client for all edge functions.
 * Handles model selection, error handling (429/402), and logging.
 */

const LOVABLE_AI_GATEWAY = 'https://ai.gateway.lovable.dev/v1/chat/completions';

export interface AICallOptions {
  model?: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  maxTokens?: number;
  tools?: any[];
  toolChoice?: any;
}

export interface AICallResult {
  content: string | null;
  toolCalls: any[] | null;
  model: string;
  latencyMs: number;
}

/**
 * Call the Lovable AI Gateway with proper error handling.
 * Throws descriptive errors for 429 (rate limit) and 402 (payment required).
 */
export async function callLovableAI(options: AICallOptions): Promise<AICallResult> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) {
    throw new Error('LOVABLE_API_KEY is not configured');
  }

  const model = options.model || 'google/gemini-3-flash-preview';
  const startTime = Date.now();

  const body: Record<string, any> = {
    model,
    messages: options.messages,
    temperature: options.temperature ?? 0.7,
  };

  if (options.maxTokens) {
    body.max_tokens = options.maxTokens;
  }

  if (options.tools) {
    body.tools = options.tools;
  }

  if (options.toolChoice) {
    body.tool_choice = options.toolChoice;
  }

  const response = await fetch(LOVABLE_AI_GATEWAY, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const latencyMs = Date.now() - startTime;

  if (!response.ok) {
    const errorText = await response.text();

    if (response.status === 429) {
      throw new AIGatewayError('Rate limit exceeded. Please try again later.', 429, errorText);
    }
    if (response.status === 402) {
      throw new AIGatewayError('AI credits exhausted. Please add funds to your workspace.', 402, errorText);
    }

    throw new AIGatewayError(`AI gateway error: ${response.status}`, response.status, errorText);
  }

  const data = await response.json();
  const choice = data.choices?.[0];

  console.log(`[AI] Model=${model} Latency=${latencyMs}ms Tokens=${data.usage?.total_tokens || 'N/A'}`);

  return {
    content: choice?.message?.content || null,
    toolCalls: choice?.message?.tool_calls || null,
    model,
    latencyMs,
  };
}

/**
 * Call Lovable AI with tool calling and parse the structured result.
 * Returns the parsed arguments from the first tool call.
 */
export async function callLovableAIWithTools<T>(
  options: AICallOptions & { tools: any[]; toolChoice: any }
): Promise<{ result: T; model: string; latencyMs: number }> {
  const aiResult = await callLovableAI(options);

  if (!aiResult.toolCalls || aiResult.toolCalls.length === 0) {
    console.warn(`[AI] No tool calls returned. Content length: ${aiResult.content?.length || 0}`);
    console.warn(`[AI] Content preview: ${aiResult.content?.substring(0, 500) || 'empty'}`);

    // Fallback: try parsing content as JSON if no tool calls returned
    if (aiResult.content) {
      try {
        // Strip markdown code fences (```json ... ``` or ``` ... ```)
        let cleaned = aiResult.content;
        cleaned = cleaned.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '');
        const jsonMatch = cleaned.match(/[\[{][\s\S]*[\]}]/);
        if (jsonMatch) {
          return {
            result: JSON.parse(jsonMatch[0]) as T,
            model: aiResult.model,
            latencyMs: aiResult.latencyMs,
          };
        }
      } catch {
        // Fall through to error
      }
    }
    throw new Error('AI did not return structured tool call output');
  }

  const toolCall = aiResult.toolCalls[0];
  const args = typeof toolCall.function.arguments === 'string'
    ? JSON.parse(toolCall.function.arguments)
    : toolCall.function.arguments;

  return {
    result: args as T,
    model: aiResult.model,
    latencyMs: aiResult.latencyMs,
  };
}

export class AIGatewayError extends Error {
  status: number;
  details: string;

  constructor(message: string, status: number, details: string) {
    super(message);
    this.name = 'AIGatewayError';
    this.status = status;
    this.details = details;
  }
}
