const AI_HORDE_BASE = 'https://aihorde.net/api/v2';

const DEFAULT_PARAMS = {
  width: 512,
  height: 512,
  steps: 20,
  cfg_scale: 7.5,
  sampler_name: 'k_euler_a',
  models: ['stable_diffusion'],
};

async function submitGeneration(prompt, opts = {}) {
  const payload = {
    prompt,
    params: {
      width: opts.width || DEFAULT_PARAMS.width,
      height: opts.height || DEFAULT_PARAMS.height,
      steps: opts.steps || DEFAULT_PARAMS.steps,
      cfg_scale: opts.cfg_scale || DEFAULT_PARAMS.cfg_scale,
      sampler_name: opts.sampler_name || DEFAULT_PARAMS.sampler_name,
      n: 1,
    },
    nsfw: opts.nsfw ?? false,
    models: opts.models || DEFAULT_PARAMS.models,
    r2: true,
    shared: opts.shared ?? false,
  };

  if (opts.negativePrompt) {
    payload.prompt = `${prompt} ### ${opts.negativePrompt}`;
  }

  const apiKey = process.env.AI_HORDE_API_KEY || '0000000000';
  const res = await fetch(`${AI_HORDE_BASE}/generate/async`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': apiKey,
      'Client-Agent': 'nikoff-chatbot:1.0',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `AI Horde API error: ${res.status}`);
  }

  return res.json();
}

async function checkGeneration(id) {
  const res = await fetch(`${AI_HORDE_BASE}/generate/check/${id}`, {
    headers: { 'Client-Agent': 'nikoff-chatbot:1.0' },
  });

  if (!res.ok) throw new Error(`AI Horde check failed: ${res.status}`);
  return res.json();
}

async function getGenerationResult(id) {
  const res = await fetch(`${AI_HORDE_BASE}/generate/status/${id}`, {
    headers: { 'Client-Agent': 'nikoff-chatbot:1.0' },
  });

  if (!res.ok) throw new Error(`AI Horde status failed: ${res.status}`);
  return res.json();
}

async function waitForGeneration(id, onProgress, maxWaitMs = 300000) {
  const startTime = Date.now();
  const pollInterval = 3000;

  while (Date.now() - startTime < maxWaitMs) {
    const check = await checkGeneration(id);

    if (onProgress) {
      onProgress(check.done || 0, (check.done || 0) + (check.wait_time || 0));
    }

    if (check.done >= (check.done + (check.wait_time || 0)) || check.faulted) {
      if (check.faulted) throw new Error('AI Horde generation faulted');
      break;
    }

    await new Promise(r => setTimeout(r, pollInterval));
  }

  const result = await getGenerationResult(id);

  if (result.faulted) throw new Error('AI Horde generation faulted');

  const generations = result.generations || [];
  if (generations.length === 0) throw new Error('AI Horde returned no images');

  return generations[0];
}

async function getAvailableModels() {
  const res = await fetch(`${AI_HORDE_BASE}/status/models`, {
    headers: { 'Client-Agent': 'nikoff-chatbot:1.0' },
  });

  if (!res.ok) return [];
  const models = await res.json();
  return models
    .filter(m => m.type === 'image')
    .sort((a, b) => b.count - a.count)
    .slice(0, 30);
}

module.exports = { submitGeneration, checkGeneration, getGenerationResult, waitForGeneration, getAvailableModels };
