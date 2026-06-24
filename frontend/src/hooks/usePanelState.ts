import { useState, useCallback } from 'react';

export function usePanelState() {
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const openPanel = useCallback((name: string) => setActivePanel(name), []);
  const closePanel = useCallback(() => setActivePanel(null), []);
  return { activePanel, openPanel, closePanel };
}
