export interface LLMConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMRequest {
  model: string;
  messages: LLMMessage[];
  temperature?: number;
  stream?: boolean;
}

export interface LLMResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export async function fetchCompletion(config: LLMConfig, messages: LLMMessage[]): Promise<string> {
  const requestBody: LLMRequest = {
    model: config.model,
    messages,
    stream: false,
  };

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
  return data.choices[0]?.message.content || '';
}
