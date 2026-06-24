import { useState, useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Image, Sparkles, Download, X, Loader2, Coins, AlertCircle } from 'lucide-react';
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

    try {
      const data = await api<{ image?: { data: string; mimeType: string }; error?: string; remainingCredits?: number }>(
        '/api/generate/image',
        {
          method: 'POST',
          body: {
            prompt: prompt.trim(),
            negativePrompt: negativePrompt.trim() || undefined,
            width,
            height,
            steps,
          },
          token: session.access_token,
        },
      );

      if (data.error) {
        setError(data.error);
        return;
      }

      if (data.image) {
        setGeneratedImage(data.image);
      }

      if (data.remainingCredits !== undefined) {
        setCredits(data.remainingCredits);
      }

      loadHistory();
    } catch (err) {
      setError('Network error. Is the generation service running?');
    } finally {
      setIsGenerating(false);
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

  const cost = (width > 512 || height > 512) ? 10 : 5;

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
                <p>Creating your image...</p>
              </div>
            ) : (
              <div className="gen-placeholder">
                <Image size={48} />
                <p>Your generated image will appear here</p>
              </div>
            )}
          </div>
        </div>

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
    </div>
  );
}
