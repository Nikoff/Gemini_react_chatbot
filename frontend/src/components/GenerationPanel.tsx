import { useState, useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Image, Sparkles, Download, X, Loader2, Coins, AlertCircle, Cloud } from 'lucide-react';
import { api } from '../utils/apiClient';

interface GenerationHistory {
  id: string;
  status: string;
  input: { prompt?: string; width?: number; height?: number; [key: string]: string | number | undefined };
  output: Record<string, unknown> | null;
  creditsUsed: number;
  createdAt: string;
  completedAt: string | null;
}

interface Props {
  session: Session;
  isOpen: boolean;
  onClose: () => void;
}

export function GenerationPanel({ session, isOpen, onClose }: Props) {
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<{ data: string; mimeType: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [credits, setCredits] = useState<number>(0);
  const [history, setHistory] = useState<GenerationHistory[]>([]);
  const [width, setWidth] = useState(512);
  const [height, setHeight] = useState(512);
  const [steps, setSteps] = useState(20);
  const [provider, setProvider] = useState<'comfyui' | 'aihorde'>('comfyui');
  const [streamProgress, setStreamProgress] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && session) {
      loadCredits();
      loadHistory();
    }
  }, [isOpen, session]);

  const loadCredits = async () => {
    try {
      const data = await api<{ balance: number }>('/api/credits', { token: session.access_token });
      setCredits(data.balance);
    } catch {}
  };

  const loadHistory = async () => {
    try {
      const data = await api<GenerationHistory[]>('/api/generate/history?limit=10', { token: session.access_token });
      setHistory(data);
    } catch {}
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;

    setIsGenerating(true);
    setError(null);
    setGeneratedImage(null);
    setStreamProgress(null);

    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${API_URL}/api/generate/image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          negativePrompt: negativePrompt.trim() || undefined,
          width,
          height,
          steps,
          provider,
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        setError(errBody.error || 'Generation failed.');
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
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
            const event = JSON.parse(line.slice(6));

            if (event.type === 'progress' && event.data) {
              setStreamProgress(event.data.message || `Processing...`);
            }

            if (event.type === 'complete' && event.data) {
              if (event.data.image) {
                setGeneratedImage(event.data.image);
              }
              if (event.data.remainingCredits !== undefined) {
                setCredits(event.data.remainingCredits);
              }
              loadHistory();
            }

            if (event.type === 'error' && event.data) {
              setError(event.data.error || 'Generation failed.');
            }
          } catch {}
        }
      }
    } catch {
      setError('Network error. Is the generation service running?');
    } finally {
      setIsGenerating(false);
      setStreamProgress(null);
    }
  };

  const handleDownload = () => {
    if (!generatedImage) return;
    const link = document.createElement('a');
    link.href = `data:${generatedImage.mimeType};base64,${generatedImage.data}`;
    link.download = `nikoff-${Date.now()}.png`;
    link.click();
  };

  if (!isOpen) return null;

  const cost = provider === 'aihorde' ? 5 : (width > 512 || height > 512) ? 10 : 5;

  return (
    <div className="generation-panel-overlay" onClick={onClose}>
      <div className="generation-panel" onClick={(e) => e.stopPropagation()}>
        <div className="gen-panel-header">
          <h2><Image size={20} /> Image Generation</h2>
          <div className="gen-panel-credits">
            <Coins size={14} /> {credits} credits
          </div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="gen-panel-body">
          <div className="gen-input-section">
            <div className="gen-field">
              <label>Provider</label>
              <div className="gen-provider-row">
                <button
                  className={`gen-provider-btn ${provider === 'comfyui' ? 'active' : ''}`}
                  onClick={() => setProvider('comfyui')}
                >
                  <Image size={14} /> Local ComfyUI
                </button>
                <button
                  className={`gen-provider-btn ${provider === 'aihorde' ? 'active' : ''}`}
                  onClick={() => setProvider('aihorde')}
                >
                  <Cloud size={14} /> AI Horde (Free)
                </button>
              </div>
            </div>

            <div className="gen-field">
              <label>Prompt</label>
              <textarea
                className="gen-textarea"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe the image you want to generate..."
                rows={3}
              />
            </div>

            <div className="gen-field">
              <label>Negative prompt (optional)</label>
              <input
                className="gen-input"
                value={negativePrompt}
                onChange={(e) => setNegativePrompt(e.target.value)}
                placeholder="Things to avoid..."
              />
            </div>

            <div className="gen-row">
              <div className="gen-field small">
                <label>Width</label>
                <select className="gen-select" value={width} onChange={(e) => setWidth(Number(e.target.value))}>
                  <option value={256}>256</option>
                  <option value={512}>512</option>
                  <option value={768}>768</option>
                  <option value={1024}>1024</option>
                </select>
              </div>
              <div className="gen-field small">
                <label>Height</label>
                <select className="gen-select" value={height} onChange={(e) => setHeight(Number(e.target.value))}>
                  <option value={256}>256</option>
                  <option value={512}>512</option>
                  <option value={768}>768</option>
                  <option value={1024}>1024</option>
                </select>
              </div>
              <div className="gen-field small">
                <label>Steps</label>
                <select className="gen-select" value={steps} onChange={(e) => setSteps(Number(e.target.value))}>
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                  <option value={20}>20</option>
                  <option value={30}>30</option>
                </select>
              </div>
            </div>

            {error && (
              <div className="gen-error">
                <AlertCircle size={14} /> {error}
              </div>
            )}

            {streamProgress && (
              <div className="gen-progress">
                <Loader2 size={14} className="spin" /> {streamProgress}
              </div>
            )}

            <button
              className="gen-generate-btn"
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim() || credits < cost}
            >
              {isGenerating ? (
                <><Loader2 size={16} className="spin" /> Generating...</>
              ) : (
                <><Sparkles size={16} /> Generate ({cost} credits)</>
              )}
            </button>
            {history.length > 0 && (
              <div className="gen-history">
                <h3>Recent Generations</h3>
                <div className="gen-history-grid">
                  {history.map((h) => (
                    <div key={h.id} className={`gen-history-item ${h.status}`}>
                      <div className="gen-history-status">
                        {h.status === 'completed' ? '\u2705' : h.status === 'failed' ? '\u274c' : '\u23f3'}
                      </div>
                      <div className="gen-history-info">
                        <span className="gen-history-prompt">{h.input?.prompt?.substring(0, 50) || 'N/A'}</span>
                        <span className="gen-history-meta">{h.creditsUsed} credits \u00b7 {new Date(h.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="gen-preview-section">
            {generatedImage ? (
              <div className="gen-result">
                <img
                  src={`data:${generatedImage.mimeType};base64,${generatedImage.data}`}
                  alt="Generated"
                  className="gen-result-image"
                />
                <button className="gen-download-btn" onClick={handleDownload}>
                  <Download size={14} /> Download
                </button>
              </div>
            ) : isGenerating ? (
              <div className="gen-loading">
                <Loader2 size={32} className="spin" />
                <p>{streamProgress || 'Creating your image...'}</p>
              </div>
            ) : (
              <div className="gen-placeholder">
                <Image size={48} />
                <p>Your generated image will appear here</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
