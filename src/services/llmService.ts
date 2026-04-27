import { executeToolCall, getAvailableTools } from "./toolService";

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolResponse {
  role: "tool";
  tool_call_id: string;
  content: string;
}

export interface LLMConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  mcpServers?: string[];
  enableFedlex?: boolean;
  enableOnlinekommentar?: boolean;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface LLMRequest {
  model: string;
  messages: LLMMessage[];
  temperature?: number;
  stream?: boolean;
  tools?: ToolDefinition[];
  tool_choice?: "auto" | "none" | string;
}

export interface LLMResponse {
  choices: Array<{
    message: {
      content: string | null;
      tool_calls?: ToolCall[];
    };
    finish_reason: string;
  }>;
}

export async function fetchCompletion(
  config: LLMConfig, 
  messages: LLMMessage[],
  onToolCall?: (toolName: string, args: string, result: string, source: string) => void
): Promise<string> {
  const tools = await getAvailableTools(config.mcpServers || [], config.enableFedlex !== false, config.enableOnlinekommentar !== false);
  
  const requestBody: LLMRequest = {
    model: config.model,
    messages,
    stream: false,
  };

  if (tools && tools.length > 0) {
    requestBody.tools = tools;
    requestBody.tool_choice = "auto";
  }

  const response = await fetch(`${config.baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    let errorText = response.statusText;
    try {
      const errorBody = await response.json();
      if (errorBody.error && errorBody.error.message) {
        errorText = errorBody.error.message;
      } else {
        errorText = JSON.stringify(errorBody);
      }
    } catch (e) {
      // Ignore JSON parse errors for error body
    }
    throw new Error(`LLM API error (${response.status}): ${errorText}`);
  }

  const data: LLMResponse = await response.json();
  const choice = data.choices[0];

  if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls) {
    // Append the assistant's tool call message
    messages.push({
      role: 'assistant',
      content: choice.message.content || null,
      tool_calls: choice.message.tool_calls
    });

    // Execute all tool calls concurrently
    const toolPromises = choice.message.tool_calls.map(async (call) => {
      const { result, source } = await executeToolCall(call, config.mcpServers || []);
      if (onToolCall) {
        onToolCall(call.function.name, call.function.arguments, result, source);
      }
      const toolResponse: LLMMessage = {
        role: "tool",
        tool_call_id: call.id,
        content: result,
      };
      return toolResponse;
    });

    const toolResponses = await Promise.all(toolPromises);
    messages.push(...toolResponses);

    // Recursively call fetchCompletion to get the final answer
    return fetchCompletion(config, messages, onToolCall);
  }

  return choice.message.content || '';
}
