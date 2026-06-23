import { useRef, useEffect } from 'react';
import { Send, ImagePlus, Mic, Square, X } from 'lucide-react';

interface Props {
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  pendingImage: { data: string; mimeType: string; preview: string } | null;
  pendingAudio: { data: string; mimeType: string } | null;
  isRecording: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onImageSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearImage: () => void;
  onClearAudio: () => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
}

export function ChatInput({ input, onInputChange, onSubmit, pendingImage, pendingAudio, isRecording, fileInputRef, onImageSelect, onClearImage, onClearAudio, onStartRecording, onStopRecording }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  const canSend = input.trim() || pendingImage || pendingAudio;
  const placeholder = pendingImage ? 'Add a caption...' : pendingAudio ? 'Add a caption (optional)...' : 'Type a message...';

  return (
    <footer className="chat-input-sticky-footer">
      {pendingImage && (
        <div className="image-preview-container">
          <img src={pendingImage.preview} alt="Preview" className="image-preview" />
          <button type="button" className="image-remove-btn" onClick={onClearImage}>
            <X size={14} />
          </button>
        </div>
      )}
      {pendingAudio && (
        <div className="audio-preview-row">
          <div className="audio-preview-container">
            <button type="button" className="audio-remove-btn" onClick={onClearAudio}>
              <X size={14} />
            </button>
            <span className="audio-preview-label">Voice message ready</span>
          </div>
          <button className="message-submit-action-button" onClick={onSubmit} disabled={!canSend}>
            <Send size={16} />
          </button>
        </div>
      )}
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="chat-form-container-wrapper">
        <input type="file" ref={fileInputRef} onChange={onImageSelect} accept="image/*" style={{ display: 'none' }} />
        <button type="button" className="image-upload-btn" onClick={() => fileInputRef.current?.click()} title="Add image">
          <ImagePlus size={18} />
        </button>
        <button
          type="button"
          className={`voice-record-btn ${isRecording ? 'recording' : ''}`}
          onClick={isRecording ? onStopRecording : onStartRecording}
          title={isRecording ? 'Stop recording' : 'Record voice'}
        >
          {isRecording ? <Square size={16} /> : <Mic size={18} />}
        </button>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          className="chat-textarea-box"
        />
        <button type="submit" className="message-submit-action-button" disabled={!canSend}>
          <Send size={16} />
        </button>
      </form>
    </footer>
  );
}
