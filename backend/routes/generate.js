const { prisma, ai, logger } = require('../middleware/shared');
const requireAuth = require('../authMiddleware');
const { ComfyUIClient, buildTextToImageWorkflow, buildImg2ImgWorkflow } = require('../services/comfyui');
const { spendCredits, CREDIT_COSTS } = require('../services/credits');

const comfyui = new ComfyUIClient(process.env.COMFYUI_URL || 'http://127.0.0.1:8188');

let comfyuiConnected = false;

async function ensureComfyUI() {
  if (comfyuiConnected) return true;
  try {
    await comfyui.connect();
    comfyuiConnected = true;
    return true;
  } catch (err) {
    logger.warn(`ComfyUI not available: ${err.message}`);
    comfyuiConnected = false;
    return false;
  }
}

module.exports = function(app, { checkSubscription, chatLimiter }) {
  app.get('/api/generate/status', requireAuth, async (req, res) => {
    const available = await ensureComfyUI();
    let stats = null;
    if (available) {
      try {
        stats = await comfyui.getSystemStats();
      } catch {}
    }
    res.json({ comfyui: available, stats });
  });

  app.post('/api/generate/image', requireAuth, checkSubscription, async (req, res) => {
    const { prompt, negativePrompt, width, height, steps, cfg, sampler, scheduler, seed, checkpoint } = req.body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({ error: 'Prompt is required.' });
    }

    if (prompt.length > 2000) {
      return res.status(400).json({ error: 'Prompt too long (max 2000 chars).' });
    }

    const available = await ensureComfyUI();
    if (!available) {
      return res.status(503).json({ error: 'Image generation service is not available.' });
    }

    const userId = req.user.sub;
    const cost = (width > 512 || height > 512) ? CREDIT_COSTS.image_gen_hd : CREDIT_COSTS.image_gen;

    const deduction = await spendCredits(userId, cost, 'image_gen');
    if (!deduction.success) {
      return res.status(402).json({ error: 'Insufficient credits.', balance: deduction.balance, needed: deduction.needed });
    }

    const execution = await prisma.execution.create({
      data: {
        userId,
        type: 'image',
        status: 'running',
        provider: 'comfyui',
        input: { prompt, negativePrompt, width, height, steps, cfg, sampler, scheduler, seed, checkpoint },
        creditsUsed: cost,
        startedAt: new Date(),
      },
    });

    try {
      const workflow = buildTextToImageWorkflow(prompt, {
        negativePrompt,
        width: width || 512,
        height: height || 512,
        steps: steps || 20,
        cfg: cfg || 7,
        sampler: sampler || 'euler',
        scheduler: scheduler || 'normal',
        seed: seed || undefined,
        checkpoint: checkpoint || undefined,
      });

      const { prompt_id } = await comfyui.queuePrompt(workflow);

      logger.info(`Queued ComfyUI prompt ${prompt_id} for user ${userId}`);

      const history = await comfyui.waitForCompletion(prompt_id, (value, max) => {
        logger.debug(`ComfyUI progress: ${value}/${max}`);
      });

      const promptHistory = history[prompt_id];
      let imageFilename = null;

      if (promptHistory && promptHistory.outputs) {
        for (const nodeId of Object.keys(promptHistory.outputs)) {
          const output = promptHistory.outputs[nodeId];
          if (output.images && output.images.length > 0) {
            imageFilename = output.images[0].filename;
            break;
          }
        }
      }

      let imageData = null;
      if (imageFilename) {
        const imageBuffer = await comfyui.getImage(imageFilename);
        imageData = {
          filename: imageFilename,
          base64: imageBuffer.toString('base64'),
          mimeType: 'image/png',
        };
      }

      await prisma.execution.update({
        where: { id: execution.id },
        data: {
          status: 'completed',
          output: { image: imageData ? { filename: imageData.filename, mimeType: imageData.mimeType } : null },
          completedAt: new Date(),
        },
      });

      res.json({
        success: true,
        executionId: execution.id,
        image: imageData ? {
          data: imageData.base64,
          mimeType: imageData.mimeType,
          filename: imageData.filename,
        } : null,
        creditsUsed: cost,
        remainingCredits: deduction.balance,
      });

    } catch (err) {
      logger.error(`ComfyUI generation failed: ${err.message}`);

      await prisma.execution.update({
        where: { id: execution.id },
        data: {
          status: 'failed',
          error: err.message,
          completedAt: new Date(),
        },
      });

      res.status(500).json({ error: 'Image generation failed.', details: err.message });
    }
  });

  app.post('/api/generate/img2img', requireAuth, checkSubscription, async (req, res) => {
    const { prompt, imageData, mimeType, negativePrompt, denoise, steps, cfg, sampler, seed } = req.body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({ error: 'Prompt is required.' });
    }

    if (!imageData || !mimeType) {
      return res.status(400).json({ error: 'Source image is required.' });
    }

    const available = await ensureComfyUI();
    if (!available) {
      return res.status(503).json({ error: 'Image generation service is not available.' });
    }

    const userId = req.user.sub;
    const cost = CREDIT_COSTS.image_gen_hd;

    const deduction = await spendCredits(userId, cost, 'image_gen');
    if (!deduction.success) {
      return res.status(402).json({ error: 'Insufficient credits.', balance: deduction.balance, needed: deduction.needed });
    }

    const execution = await prisma.execution.create({
      data: {
        userId,
        type: 'image',
        status: 'running',
        provider: 'comfyui',
        input: { prompt, denoise, steps, cfg, sampler, seed },
        creditsUsed: cost,
        startedAt: new Date(),
      },
    });

    try {
      const workflow = buildImg2ImgWorkflow(prompt, imageData, mimeType, {
        negativePrompt,
        denoise: denoise || 0.7,
        steps: steps || 20,
        cfg: cfg || 7,
        sampler: sampler || 'euler',
        seed: seed || undefined,
      });

      const { prompt_id } = await comfyui.queuePrompt(workflow);

      const history = await comfyui.waitForCompletion(prompt_id);

      const promptHistory = history[prompt_id];
      let imageFilename = null;

      if (promptHistory && promptHistory.outputs) {
        for (const nodeId of Object.keys(promptHistory.outputs)) {
          const output = promptHistory.outputs[nodeId];
          if (output.images && output.images.length > 0) {
            imageFilename = output.images[0].filename;
            break;
          }
        }
      }

      let imageResult = null;
      if (imageFilename) {
        const imageBuffer = await comfyui.getImage(imageFilename);
        imageResult = {
          data: imageBuffer.toString('base64'),
          mimeType: 'image/png',
          filename: imageFilename,
        };
      }

      await prisma.execution.update({
        where: { id: execution.id },
        data: {
          status: 'completed',
          output: { image: imageResult ? { filename: imageResult.filename } : null },
          completedAt: new Date(),
        },
      });

      res.json({
        success: true,
        executionId: execution.id,
        image: imageResult,
        creditsUsed: cost,
        remainingCredits: deduction.balance,
      });

    } catch (err) {
      logger.error(`ComfyUI img2img failed: ${err.message}`);

      await prisma.execution.update({
        where: { id: execution.id },
        data: {
          status: 'failed',
          error: err.message,
          completedAt: new Date(),
        },
      });

      res.status(500).json({ error: 'Image generation failed.', details: err.message });
    }
  });

  app.get('/api/generate/history', requireAuth, async (req, res) => {
    const userId = req.user.sub;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);

    try {
      const executions = await prisma.execution.findMany({
        where: { userId, type: 'image' },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          status: true,
          input: true,
          output: true,
          creditsUsed: true,
          createdAt: true,
          completedAt: true,
        },
      });

      res.json(executions);
    } catch (err) {
      logger.error(`GET /api/generate/history failed: ${err.message}`);
      res.status(500).json({ error: 'Failed to fetch generation history.' });
    }
  });

  app.get('/api/credits', requireAuth, async (req, res) => {
    const { getOrCreateCredit, getCreditHistory } = require('../services/credits');
    try {
      const credit = await getOrCreateCredit(req.user.sub);
      const history = await getCreditHistory(req.user.sub, 20);
      res.json({ balance: credit.balance, history });
    } catch (err) {
      logger.error(`GET /api/credits failed: ${err.message}`);
      res.status(500).json({ error: 'Failed to fetch credits.' });
    }
  });
};
