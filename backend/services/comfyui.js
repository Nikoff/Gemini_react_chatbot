const WebSocket = require('ws');
const http = require('http');
const crypto = require('crypto');
const logger = require('../logger');

const COMFYUI_URL = process.env.COMFYUI_URL || 'http://127.0.0.1:8188';

class ComfyUIClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.wsUrl = baseUrl.replace('http', 'ws');
    this.ws = null;
    this.clientId = crypto.randomUUID();
    this.pendingRequests = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectDelay = 30000;
    this.isReconnecting = false;
  }

  connect() {
    return new Promise((resolve, reject) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        return resolve();
      }

      this.ws = new WebSocket(`${this.wsUrl}/ws?clientId=${this.clientId}`);

      this.ws.on('open', () => {
        logger.info('ComfyUI WebSocket connected');
        this.reconnectAttempts = 0;
        this.isReconnecting = false;
        resolve();
      });

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this._handleMessage(message);
        } catch (err) {
          logger.error(`ComfyUI WS parse error: ${err.message}`);
        }
      });

      this.ws.on('close', () => {
        logger.info('ComfyUI WebSocket disconnected');
        this.ws = null;
        this._scheduleReconnect();
      });

      this.ws.on('error', (err) => {
        logger.error(`ComfyUI WS error: ${err.message}`);
        reject(err);
      });

      setTimeout(() => reject(new Error('ComfyUI connection timeout')), 10000);
    });
  }

  _scheduleReconnect() {
    if (this.isReconnecting) return;
    this.isReconnecting = true;

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), this.maxReconnectDelay);
    this.reconnectAttempts++;

    logger.info(`ComfyUI reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      this.connect().catch(() => {
        this._scheduleReconnect();
      });
    }, delay);
  }

  reconnect() {
    this.disconnect();
    this.reconnectAttempts = 0;
    this.isReconnecting = false;
    return this.connect();
  }

  _handleMessage(message) {
    const { type, data } = message;

    if (type === 'executing') {
      const nodeId = data.node;
      const promptId = data.prompt_id;
      if (nodeId === null && this.pendingRequests.has(promptId)) {
        const req = this.pendingRequests.get(promptId);
        this.pendingRequests.delete(promptId);
        req.resolve(data);
      }
    }

    if (type === 'execution_error') {
      const promptId = data.prompt_id;
      if (this.pendingRequests.has(promptId)) {
        const req = this.pendingRequests.get(promptId);
        this.pendingRequests.delete(promptId);
        req.reject(new Error(data.exception_message || 'ComfyUI execution error'));
      }
    }

    if (type === 'progress') {
      const { value, max } = data;
      const promptId = data.prompt_id;
      if (this.pendingRequests.has(promptId)) {
        const req = this.pendingRequests.get(promptId);
        if (req.onProgress) {
          req.onProgress(value, max);
        }
      }
    }
  }

  async queuePrompt(workflow, retries = 2) {
    const payload = {
      prompt: workflow,
      client_id: this.clientId,
    };

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await new Promise((resolve, reject) => {
          const postData = JSON.stringify(payload);
          const url = new URL('/prompt', this.baseUrl);

          const req = http.request({
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(postData),
            },
          }, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
              try {
                const data = JSON.parse(body);
                if (data.error) {
                  reject(new Error(data.error));
                } else {
                  resolve(data);
                }
              } catch (err) {
                reject(err);
              }
            });
          });

          req.on('error', reject);
          req.write(postData);
          req.end();
        });
      } catch (err) {
        if (attempt === retries) throw err;
        logger.warn(`ComfyUI queuePrompt attempt ${attempt + 1} failed: ${err.message}, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }

  async waitForCompletion(promptId, onProgress) {
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(promptId, {
        resolve,
        reject,
        onProgress,
      });

      setTimeout(() => {
        if (this.pendingRequests.has(promptId)) {
          this.pendingRequests.delete(promptId);
          reject(new Error('ComfyUI execution timeout (5 minutes)'));
        }
      }, 5 * 60 * 1000);
    });
  }

  async getHistory(promptId) {
    return new Promise((resolve, reject) => {
      const url = new URL(`/history/${promptId}`, this.baseUrl);

      http.get(url.href, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (err) {
            reject(err);
          }
        });
      }).on('error', reject);
    });
  }

  async getImage(filename, subfolder, type) {
    return new Promise((resolve, reject) => {
      const params = new URLSearchParams({ filename, subfolder: subfolder || '', type: type || 'output' });
      const url = new URL(`/view?${params}`, this.baseUrl);

      http.get(url.href, (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      }).on('error', reject);
    });
  }

  async getSystemStats() {
    return new Promise((resolve, reject) => {
      const url = new URL('/system_stats', this.baseUrl);

      http.get(url.href, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (err) {
            reject(err);
          }
        });
      }).on('error', reject);
    });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

function buildTextToImageWorkflow(prompt, params = {}) {
  const {
    negativePrompt = 'blurry, low quality, deformed',
    width = 512,
    height = 512,
    steps = 20,
    cfg = 7,
    sampler = 'euler',
    scheduler = 'normal',
    seed = Math.floor(Math.random() * 2147483647),
    checkpoint = 'sd_xl_base_1.0.safetensors',
  } = params;

  return {
    '3': {
      class_type: 'KSampler',
      inputs: {
        seed,
        steps,
        cfg,
        sampler_name: sampler,
        scheduler,
        denoise: 1.0,
        model: ['4', 0],
        positive: ['6', 0],
        negative: ['7', 0],
        latent_image: ['5', 0],
      },
    },
    '4': {
      class_type: 'CheckpointLoaderSimple',
      inputs: { ckpt_name: checkpoint },
    },
    '5': {
      class_type: 'EmptyLatentImage',
      inputs: { width, height, batch_size: 1 },
    },
    '6': {
      class_type: 'CLIPTextEncode',
      inputs: { text: prompt, clip: ['4', 1] },
    },
    '7': {
      class_type: 'CLIPTextEncode',
      inputs: { text: negativePrompt, clip: ['4', 1] },
    },
    '8': {
      class_type: 'VAEDecode',
      inputs: { samples: ['3', 0], vae: ['4', 2] },
    },
    '9': {
      class_type: 'SaveImage',
      inputs: { filename_prefix: 'nikoff', images: ['8', 0] },
    },
  };
}

function buildImg2ImgWorkflow(prompt, imageBase64, mimeType, params = {}) {
  const {
    negativePrompt = 'blurry, low quality, deformed',
    steps = 20,
    cfg = 7,
    sampler = 'euler',
    scheduler = 'normal',
    denoise = 0.7,
    seed = Math.floor(Math.random() * 2147483647),
    checkpoint = 'sd_xl_base_1.0.safetensors',
  } = params;

  return {
    '1': {
      class_type: 'LoadImage',
      inputs: { image: imageBase64 },
    },
    '4': {
      class_type: 'CheckpointLoaderSimple',
      inputs: { ckpt_name: checkpoint },
    },
    '6': {
      class_type: 'CLIPTextEncode',
      inputs: { text: prompt, clip: ['4', 1] },
    },
    '7': {
      class_type: 'CLIPTextEncode',
      inputs: { text: negativePrompt, clip: ['4', 1] },
    },
    '8': {
      class_type: 'VAEEncode',
      inputs: { pixels: ['1', 0], vae: ['4', 2] },
    },
    '3': {
      class_type: 'KSampler',
      inputs: {
        seed,
        steps,
        cfg,
        sampler_name: sampler,
        scheduler,
        denoise,
        model: ['4', 0],
        positive: ['6', 0],
        negative: ['7', 0],
        latent_image: ['8', 0],
      },
    },
    '9': {
      class_type: 'VAEDecode',
      inputs: { samples: ['3', 0], vae: ['4', 2] },
    },
    '10': {
      class_type: 'SaveImage',
      inputs: { filename_prefix: 'nikoff_i2i', images: ['9', 0] },
    },
  };
}

module.exports = { ComfyUIClient, buildTextToImageWorkflow, buildImg2ImgWorkflow };
