import { describe, it, expect, vi } from 'vitest';
import { consumeSSEStream, type StreamCallbacks } from './sseStream';

function makeStreamResponse(raw: string): Response {
  const encoder = new TextEncoder();
  return new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(raw));
      controller.close();
    },
  }));
}

function makeMultiChunkResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  let i = 0;
  return new Response(new ReadableStream({
    start(controller) {
      function push() {
        if (i < chunks.length) {
          controller.enqueue(encoder.encode(chunks[i++]));
          push();
        } else {
          controller.close();
        }
      }
      push();
    },
  }));
}

describe('consumeSSEStream', () => {
  it('parses chunk events and accumulates fullText', async () => {
    const raw = 'data: {"type":"chunk","text":"Hello "}\n\ndata: {"type":"chunk","text":"World"}\n\n';
    const res = makeStreamResponse(raw);
    const onChunk = vi.fn();

    const result = await consumeSSEStream(res, { onChunk });
    expect(result).toBe('Hello World');
    expect(onChunk).toHaveBeenCalledTimes(2);
    expect(onChunk).toHaveBeenCalledWith('Hello ', 'Hello ');
    expect(onChunk).toHaveBeenCalledWith('World', 'Hello World');
  });

  it('calls onDone with usage and modelUsed', async () => {
    const raw = 'data: {"type":"done","usage":{"promptTokens":10,"candidatesTokens":5,"totalTokens":15},"modelUsed":"gemini-2.5-flash"}\n\n';
    const res = makeStreamResponse(raw);
    const onDone = vi.fn();

    await consumeSSEStream(res, { onDone });
    expect(onDone).toHaveBeenCalledWith(
      { promptTokens: 10, candidatesTokens: 5, totalTokens: 15 },
      'gemini-2.5-flash'
    );
  });

  it('calls onError with error string', async () => {
    const raw = 'data: {"type":"error","error":"Something failed"}\n\n';
    const res = makeStreamResponse(raw);
    const onError = vi.fn();

    await consumeSSEStream(res, { onError });
    expect(onError).toHaveBeenCalledWith('Something failed');
  });

  it('calls onToolCall with name, args, result', async () => {
    const raw = 'data: {"type":"tool_call","name":"calculator","args":{"expression":"2+2"},"result":"4"}\n\n';
    const res = makeStreamResponse(raw);
    const onToolCall = vi.fn();

    await consumeSSEStream(res, { onToolCall });
    expect(onToolCall).toHaveBeenCalledWith('calculator', { expression: '2+2' }, '4');
  });

  it('handles partial SSE frames (incomplete lines)', async () => {
    const chunks = [
      'data: {"type":"chunk","tex',
      't":"Hi"}\n\ndata: {"type":"chunk","text":"!"}\n\n',
    ];
    const res = makeMultiChunkResponse(chunks);
    const onChunk = vi.fn();

    const result = await consumeSSEStream(res, { onChunk });
    expect(result).toBe('Hi!');
    expect(onChunk).toHaveBeenCalledTimes(2);
  });

  it('handles empty response body', async () => {
    const res = makeStreamResponse('');
    const result = await consumeSSEStream(res, {});
    expect(result).toBe('');
  });

  it('ignores lines without data: prefix', async () => {
    const raw = ': ping\n\ndata: {"type":"chunk","text":"ok"}\n\n';
    const res = makeStreamResponse(raw);
    const onChunk = vi.fn();

    const result = await consumeSSEStream(res, { onChunk });
    expect(result).toBe('ok');
    expect(onChunk).toHaveBeenCalledTimes(1);
  });
});
