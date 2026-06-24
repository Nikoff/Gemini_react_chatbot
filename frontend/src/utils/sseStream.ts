export interface SSEChunk {
  type: 'chunk' | 'done' | 'error' | 'tool_call';
  text?: string;
  usage?: {
    promptTokens: number;
    candidatesTokens: number;
    totalTokens: number;
  };
  modelUsed?: string;
  error?: string;
  name?: string;
  args?: any;
  result?: string;
}

export interface StreamCallbacks {
  onChunk?: (text: string, fullText: string) => void;
  onDone?: (usage: SSEChunk['usage'], modelUsed: string) => void;
  onError?: (error: string) => void;
  onToolCall?: (name: string, args: any, result: string) => void;
}

export async function consumeSSEStream(
  response: Response,
  callbacks: StreamCallbacks
): Promise<string> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        const event: SSEChunk = JSON.parse(line.slice(6));

        if (event.type === 'chunk' && event.text) {
          fullText += event.text;
          callbacks.onChunk?.(event.text, fullText);
        } else if (event.type === 'done') {
          callbacks.onDone?.(event.usage, event.modelUsed || '');
        } else if (event.type === 'error' && event.error) {
          callbacks.onError?.(event.error);
        } else if (event.type === 'tool_call') {
          callbacks.onToolCall?.(event.name || '', event.args, event.result || '');
        }
      } catch {}
    }
  }

  return fullText;
}
