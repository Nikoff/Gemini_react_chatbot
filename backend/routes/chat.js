const { prisma, ai, chatSchema, ALLOWED_MODELS, logger } = require('../middleware/shared');
const requireAuth = require('../authMiddleware');

module.exports = function(app, { checkSubscription, chatLimiter }) {
  app.post('/api/chat', requireAuth, checkSubscription, chatLimiter, async (req, res) => {
    const parsed = chatSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request body.', details: parsed.error.issues });
    }

    const { messages, model, threadId } = parsed.data;
    const targetModel = model || 'gemini-2.5-flash';
    const userId = req.user.sub;

    if (!ALLOWED_MODELS.includes(targetModel)) {
      return res.status(400).json({ error: 'Model not allowed.' });
    }

    logger.info(`Chat request from ${req.user.email} | model: ${targetModel}`);

    try {
      const formattedHistory = messages.map(msg => {
        const parts = [];
        if (msg.text) parts.push({ text: msg.text });
        if (msg.image) {
          parts.push({
            inlineData: {
              mimeType: msg.image.mimeType,
              data: msg.image.data,
            },
          });
        }
        if (msg.audio) {
          parts.push({
            inlineData: {
              mimeType: msg.audio.mimeType,
              data: msg.audio.data,
            },
          });
        }
        return {
          role: msg.role === 'ai' ? 'model' : 'user',
          parts: parts.length ? parts : [{ text: '' }],
        };
      });

      const requestPayload = { model: targetModel, contents: formattedHistory };

      if (targetModel.includes('gemma')) {
        requestPayload.config = { temperature: 1.0, topP: 0.95, topK: 64 };
      }

      const tools = [
        {
          functionDeclarations: [
            {
              name: 'calculator',
              description: 'Perform mathematical calculations. Use this for math problems, unit conversions, or any computation.',
              parameters: {
                type: 'OBJECT',
                properties: {
                  expression: { type: 'STRING', description: 'The mathematical expression to evaluate' },
                },
                required: ['expression'],
              },
            },
            {
              name: 'get_current_time',
              description: 'Get the current date and time.',
              parameters: { type: 'OBJECT', properties: {} },
            },
          ],
        },
      ];

      requestPayload.tools = tools;

      const stream = await ai.models.generateContentStream(requestPayload);

      let fullText = '';
      let promptTokens = 0;
      let candidatesTokens = 0;

      for await (const chunk of stream) {
        const chunkText = chunk.text || '';
        if (chunkText) {
          fullText += chunkText;
          res.write(`data: ${JSON.stringify({ type: 'chunk', text: chunkText })}\n\n`);
        }

        if (chunk.usageMetadata) {
          promptTokens = chunk.usageMetadata.promptTokenCount || 0;
          candidatesTokens = chunk.usageMetadata.candidatesTokenCount || 0;
        }
      }

      if (threadId && fullText) {
        const thread = await prisma.thread.findUnique({ where: { id: threadId } });
        if (thread && thread.userId === userId) {
          const lastUserMsg = messages[messages.length - 1];
          if (lastUserMsg) {
            await prisma.$transaction([
              prisma.message.createMany({
                data: [
                  { threadId, role: 'user', content: lastUserMsg.text },
                  { threadId, role: 'model', content: fullText, tokens: candidatesTokens },
                ],
              }),
              prisma.thread.update({ where: { id: threadId }, data: { updatedAt: new Date() } }),
            ]);
          }
        }
      }

      res.write(`data: ${JSON.stringify({ type: 'done', usage: { promptTokens, candidatesTokens, totalTokens: promptTokens + candidatesTokens }, modelUsed: targetModel })}\n\n`);
      res.end();

    } catch (error) {
      logger.error(`Stream failed: ${error.message}`);
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'An error occurred during processing.' })}\n\n`);
      res.end();
    }
  });

  app.post('/api/threads/:threadId/regenerate', requireAuth, checkSubscription, chatLimiter, async (req, res) => {
    const { threadId } = req.params;
    const { messageId, model } = req.body;
    const targetModel = model || 'gemini-2.5-flash';

    if (!ALLOWED_MODELS.includes(targetModel)) {
      return res.status(400).json({ error: 'Model not allowed.' });
    }

    try {
      const thread = await prisma.thread.findUnique({ where: { id: threadId } });
      if (!thread || thread.userId !== req.user.sub) {
        return res.status(404).json({ error: 'Thread not found.' });
      }

      const allMessages = await prisma.message.findMany({
        where: { threadId },
        orderBy: { createdAt: 'asc' },
      });

      const branchIndex = allMessages.findIndex(m => m.id === messageId);
      if (branchIndex === -1) {
        return res.status(404).json({ error: 'Message not found.' });
      }

      const messagesBefore = allMessages.slice(0, branchIndex);
      await prisma.message.deleteMany({
        where: { threadId, id: { in: allMessages.slice(branchIndex).map(m => m.id) } },
      });

      const formattedHistory = messagesBefore.map(msg => ({
        role: msg.role === 'model' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      }));

      const systemInstruction = thread.systemPrompt ? [{ text: thread.systemPrompt }] : undefined;

      const stream = await ai.models.generateContentStream({
        model: targetModel,
        contents: formattedHistory,
        ...(systemInstruction && { config: { systemInstruction } }),
      });

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      let fullText = '';
      let promptTokens = 0;
      let candidatesTokens = 0;

      for await (const chunk of stream) {
        const chunkText = chunk.text || '';
        if (chunkText) {
          fullText += chunkText;
          res.write(`data: ${JSON.stringify({ type: 'chunk', text: chunkText })}\n\n`);
        }
        if (chunk.usageMetadata) {
          promptTokens = chunk.usageMetadata.promptTokenCount || 0;
          candidatesTokens = chunk.usageMetadata.candidatesTokenCount || 0;
        }

        if (chunk.functionCalls && chunk.functionCalls.length > 0) {
          for (const call of chunk.functionCalls) {
          let result = '';
          if (call.name === 'calculator') {
            try {
              const expr = call.args.expression;
              if (!/^[\d\s+\-*/().%]+$/.test(expr)) {
                result = 'Error: Invalid characters in expression';
              } else {
                const safeEval = Function('"use strict"; return (' + expr + ')');
                result = String(safeEval());
              }
            } catch { result = 'Error: Invalid expression'; }
            } else if (call.name === 'get_current_time') {
              result = new Date().toISOString();
            }
            res.write(`data: ${JSON.stringify({ type: 'tool_call', name: call.name, args: call.args, result })}\n\n`);
            formattedHistory.push({ role: 'model', parts: [{ functionCall: call }] });
            formattedHistory.push({ role: 'user', parts: [{ functionResponse: { name: call.name, response: { result } } }] });
          }

          const secondStream = await ai.models.generateContentStream({ model: targetModel, contents: formattedHistory, tools });
          for await (const chunk2 of secondStream) {
            const t = chunk2.text || '';
            if (t) {
              fullText += t;
              res.write(`data: ${JSON.stringify({ type: 'chunk', text: t })}\n\n`);
            }
            if (chunk2.usageMetadata) {
              promptTokens += chunk2.usageMetadata.promptTokenCount || 0;
              candidatesTokens += chunk2.usageMetadata.candidatesTokenCount || 0;
            }
          }
        }
      }

      if (fullText) {
        await prisma.message.create({
          data: { threadId, role: 'model', content: fullText, tokens: candidatesTokens },
        });
        await prisma.thread.update({ where: { id: threadId }, data: { updatedAt: new Date() } });
      }

      res.write(`data: ${JSON.stringify({ type: 'done', usage: { promptTokens, candidatesTokens, totalTokens: promptTokens + candidatesTokens }, modelUsed: targetModel })}\n\n`);
      res.end();

    } catch (error) {
      logger.error(`Regenerate failed: ${error.message}`);
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'Regeneration failed.' })}\n\n`);
      res.end();
    }
  });
};
