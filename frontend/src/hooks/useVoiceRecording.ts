import { useState, useRef, useCallback } from 'react';

export function useVoiceRecording() {
  const [isRecording, setIsRecording] = useState(false);
  const [pendingAudio, setPendingAudio] = useState<{ data: string; mimeType: string } | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          setPendingAudio({ data: base64, mimeType: 'audio/webm' });
        };
        reader.readAsDataURL(blob);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (err) {
      console.error('Microphone access denied:', err);
    }
  }, []);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setIsRecording(false);
  }, []);

  const clearAudio = useCallback(() => setPendingAudio(null), []);

  return { isRecording, pendingAudio, startRecording, stopRecording, clearAudio };
}
