import { useState, useCallback, useEffect, useRef } from 'react';
import type { Session } from '@supabase/supabase-js';
import { ReactFlow, Controls, Background, addEdge, useNodesState, useEdgesState, Handle, Position, type Connection, type Node, type Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { X, Play, Save, Plus, Trash2, Pencil, FileText, Image, Wand2, Square, BookOpen, Video, Box, PenTool, Clapperboard, Layers, Settings, Mic } from 'lucide-react';
import { api } from '../utils/apiClient';
import { useI18n } from '../context/I18nContext';

interface PaletteNodeDef {
  backendType: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  description: string;
  defaultConfig?: Record<string, string>;
}

const ALL_PALETTE_NODES: PaletteNodeDef[] = [
  { backendType: 'input', label: 'Start', icon: <Plus size={14} />, color: '#10b981', description: 'Provide input data', defaultConfig: { defaultValue: '' } },
  { backendType: 'text_gen', label: 'Generate Text', icon: <FileText size={14} />, color: '#3b82f6', description: 'Generate text with AI', defaultConfig: { prompt: '' } },
  { backendType: 'image_gen', label: 'Generate Image', icon: <Image size={14} />, color: '#8b5cf6', description: 'Generate image with AI', defaultConfig: { prompt: '' } },
  { backendType: 'transform', label: 'Transform', icon: <Wand2 size={14} />, color: '#f59e0b', description: 'Transform data with template', defaultConfig: { template: '' } },
  { backendType: 'output', label: 'End', icon: <Square size={14} />, color: '#ef4444', description: 'Output result' },
];

const PROJECT_TYPES = {
  blog: {
    label: 'Blog',
    icon: <BookOpen size={14} />,
    nodes: [
      { ...ALL_PALETTE_NODES[0], label: 'Start' },
      { ...ALL_PALETTE_NODES[1], label: 'Text Prompt', description: 'Custom text prompt', defaultConfig: { prompt: '{{input}}' } },
      { ...ALL_PALETTE_NODES[1], label: 'Write Article', description: 'Write blog post content', defaultConfig: { prompt: 'Write a detailed blog article about: {{input}}' } },
      { ...ALL_PALETTE_NODES[1], label: 'SEO Optimize', description: 'Optimize for search engines', defaultConfig: { prompt: 'Optimize this article for SEO, add keywords and meta description:\n\n{{input}}' } },
      { ...ALL_PALETTE_NODES[2], label: 'Featured Image', description: 'Create blog featured image', defaultConfig: { prompt: 'Blog featured image for: {{input}}' } },
      { ...ALL_PALETTE_NODES[4], label: 'End' },
    ],
  },
  image: {
    label: 'Image',
    icon: <Image size={14} />,
    nodes: [
      { ...ALL_PALETTE_NODES[0], label: 'Start' },
      { ...ALL_PALETTE_NODES[1], label: 'Text Prompt', description: 'Custom text prompt', defaultConfig: { prompt: '{{input}}' } },
      { ...ALL_PALETTE_NODES[2], label: 'Generate Image', description: 'Create image from prompt', defaultConfig: { prompt: '{{input}}' } },
      { ...ALL_PALETTE_NODES[2], label: 'Enhance Image', description: 'Refine and enhance image', defaultConfig: { prompt: 'Enhance and improve: {{input}}' } },
      { ...ALL_PALETTE_NODES[4], label: 'End' },
    ],
  },
  video: {
    label: 'Video',
    icon: <Video size={14} />,
    nodes: [
      { ...ALL_PALETTE_NODES[0], label: 'Start' },
      { ...ALL_PALETTE_NODES[1], label: 'Text Prompt', description: 'Custom text prompt', defaultConfig: { prompt: '{{input}}' } },
      { ...ALL_PALETTE_NODES[1], label: 'Script Writer', description: 'Write video script', defaultConfig: { prompt: 'Write a video script for: {{input}}' } },
      { ...ALL_PALETTE_NODES[2], label: 'StoryBoard', description: 'Generate storyboard frames', defaultConfig: { prompt: 'Storyboard frame for scene: {{input}}' } },
      { ...ALL_PALETTE_NODES[1], label: 'Scene Description', description: 'Describe each scene in detail', defaultConfig: { prompt: 'Describe this scene in detail for video production:\n\n{{input}}' } },
      { ...ALL_PALETTE_NODES[4], label: 'End' },
    ],
  },
  '3d': {
    label: '3D Model',
    icon: <Box size={14} />,
    nodes: [
      { ...ALL_PALETTE_NODES[0], label: 'Start' },
      { ...ALL_PALETTE_NODES[1], label: 'Text Prompt', description: 'Custom text prompt', defaultConfig: { prompt: '{{input}}' } },
      { ...ALL_PALETTE_NODES[1], label: 'Model Description', description: 'Describe 3D model specs', defaultConfig: { prompt: 'Describe this 3D model in detail including dimensions, materials, and texture:\n\n{{input}}' } },
      { ...ALL_PALETTE_NODES[2], label: 'Generate Texture', description: 'Create texture maps', defaultConfig: { prompt: 'Seamless texture for 3D model: {{input}}' } },
      { ...ALL_PALETTE_NODES[4], label: 'End' },
    ],
  },
  voice: {
    label: 'Voice',
    icon: <Mic size={14} />,
    nodes: [
      { ...ALL_PALETTE_NODES[0], label: 'Start' },
      { ...ALL_PALETTE_NODES[1], label: 'Text Prompt', description: 'Custom text prompt', defaultConfig: { prompt: '{{input}}' } },
      { ...ALL_PALETTE_NODES[1], label: 'Write Script', description: 'Write voiceover script', defaultConfig: { prompt: 'Write a natural-sounding voiceover script for: {{input}}' } },
      { ...ALL_PALETTE_NODES[1], label: 'Tone Adjust', description: 'Adjust tone and pacing', defaultConfig: { prompt: 'Rewrite this script with a specific tone and pacing for voice narration:\n\n{{input}}' } },
      { ...ALL_PALETTE_NODES[3], label: 'Format for TTS', description: 'Optimize text for text-to-speech', defaultConfig: { template: '{{input}}' } },
      { ...ALL_PALETTE_NODES[1], label: 'Multi-Language', description: 'Translate or adapt for other languages', defaultConfig: { prompt: 'Translate this voiceover script while preserving natural speech flow:\n\n{{input}}' } },
      { ...ALL_PALETTE_NODES[4], label: 'End' },
    ],
  },
  text: {
    label: 'Text',
    icon: <PenTool size={14} />,
    nodes: [
      { ...ALL_PALETTE_NODES[0], label: 'Start' },
      { ...ALL_PALETTE_NODES[1], label: 'Text Prompt', description: 'Custom text prompt', defaultConfig: { prompt: '{{input}}' } },
      { ...ALL_PALETTE_NODES[1], label: 'Generate Text', description: 'Generate text content', defaultConfig: { prompt: '{{input}}' } },
      { ...ALL_PALETTE_NODES[3], label: 'Edit & Refine', description: 'Polish and format text', defaultConfig: { template: '{{input}}' } },
      { ...ALL_PALETTE_NODES[4], label: 'End' },
    ],
  },
  scenario: {
    label: 'Scenario',
    icon: <Clapperboard size={14} />,
    nodes: [
      { ...ALL_PALETTE_NODES[0], label: 'Start' },
      { ...ALL_PALETTE_NODES[1], label: 'Text Prompt', description: 'Custom text prompt', defaultConfig: { prompt: '{{input}}' } },
      { ...ALL_PALETTE_NODES[1], label: 'Character Writer', description: 'Create character profiles', defaultConfig: { prompt: 'Create detailed character profiles for: {{input}}' } },
      { ...ALL_PALETTE_NODES[1], label: 'Dialogue Writer', description: 'Write character dialogues', defaultConfig: { prompt: 'Write dialogues for this scenario:\n\n{{input}}' } },
      { ...ALL_PALETTE_NODES[2], label: 'Scene Visual', description: 'Visualize scene composition', defaultConfig: { prompt: 'Scene visualization: {{input}}' } },
      { ...ALL_PALETTE_NODES[1], label: 'Narrative', description: 'Write narrative descriptions', defaultConfig: { prompt: 'Write narrative for this scene:\n\n{{input}}' } },
      { ...ALL_PALETTE_NODES[4], label: 'End' },
    ],
  },
  complex: {
    label: 'Complex',
    icon: <Layers size={14} />,
    nodes: [
      { ...ALL_PALETTE_NODES[0], label: 'Start' },
      { ...ALL_PALETTE_NODES[1], label: 'Text Prompt', description: 'Custom text prompt', defaultConfig: { prompt: '{{input}}' } },
      ...ALL_PALETTE_NODES.slice(1),
    ],
  },
  custom: {
    label: 'Custom',
    icon: <Settings size={14} />,
    nodes: [
      { ...ALL_PALETTE_NODES[0], label: 'Start' },
      { ...ALL_PALETTE_NODES[1], label: 'Text Prompt', description: 'Custom text prompt', defaultConfig: { prompt: '{{input}}' } },
      ...ALL_PALETTE_NODES.slice(1),
    ],
  },
} as const;

type ProjectTypeKey = keyof typeof PROJECT_TYPES;

interface Props {
  session: Session;
  isOpen: boolean;
  onClose: () => void;
}

interface GraphNode {
  id: string;
  type: string;
  label?: string;
  config?: Record<string, string>;
  position?: { x: number; y: number };
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

interface Workflow {
  id: string;
  name: string;
  description?: string;
  projectType?: string;
  graph: { nodes: GraphNode[]; edges: GraphEdge[] };
}

function getPaletteForType(projectType: ProjectTypeKey): PaletteNodeDef[] {
  return [...(PROJECT_TYPES[projectType]?.nodes || PROJECT_TYPES.custom.nodes)];
}

function CustomNode({ data, selected }: { data: Record<string, unknown> & { nodeType: string; label?: string; config?: Record<string, string>; onConfigChange?: (key: string, value: string) => void; onLabelChange?: (label: string) => void }; selected?: boolean }) {
  const allNodes = ALL_PALETTE_NODES;
  const fallback = allNodes.find(n => n.backendType === data.nodeType) || allNodes[0];
  const nodeColor = (data.color as string) || fallback.color;
  const nodeLabel = (data.label as string) || fallback.label;

  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(nodeLabel);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleRenameStart = () => {
    setEditValue(nodeLabel);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleRenameConfirm = () => {
    const trimmed = editValue.trim();
    if (trimmed) data.onLabelChange?.(trimmed);
    setEditing(false);
  };

  return (
    <div className={`workflow-node ${selected ? 'selected' : ''}`} style={{ borderColor: selected ? '#f8fafc' : nodeColor }}>
      <Handle type="target" position={Position.Left} style={{ background: nodeColor }} />
      <div className="workflow-node-header" style={{ background: nodeColor }}>
        {fallback.icon}
        {editing ? (
          <input
            ref={inputRef}
            className="node-rename-input"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleRenameConfirm}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRenameConfirm();
              if (e.key === 'Escape') setEditing(false);
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="node-label" onDoubleClick={handleRenameStart} title="Double-click to rename">
            {nodeLabel}
          </span>
        )}
        {!editing && (
          <button className="node-rename-btn" onClick={(e) => { e.stopPropagation(); handleRenameStart(); }} title="Rename node">
            <Pencil size={10} />
          </button>
        )}
      </div>
      <div className="workflow-node-body">
        {data.nodeType === 'text_gen' && (
          <div className="node-config">
            <textarea
              className="node-textarea"
              value={data.config?.prompt || ''}
              onChange={(e) => data.onConfigChange?.('prompt', e.target.value)}
              placeholder="Prompt template... use {{input}} for input"
              rows={2}
            />
          </div>
        )}
        {data.nodeType === 'image_gen' && (
          <div className="node-config">
            <textarea
              className="node-textarea"
              value={data.config?.prompt || ''}
              onChange={(e) => data.onConfigChange?.('prompt', e.target.value)}
              placeholder="Image prompt... use {{input}} for input"
              rows={2}
            />
          </div>
        )}
        {data.nodeType === 'transform' && (
          <div className="node-config">
            <textarea
              className="node-textarea"
              value={data.config?.template || ''}
              onChange={(e) => data.onConfigChange?.('template', e.target.value)}
              placeholder="Template... use {{variable}} syntax"
              rows={2}
            />
          </div>
        )}
        {data.nodeType === 'input' && (
          <div className="node-config">
            <input
              className="node-input"
              value={data.config?.defaultValue || ''}
              onChange={(e) => data.onConfigChange?.('defaultValue', e.target.value)}
              placeholder="Default value"
            />
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} style={{ background: nodeColor }} />
    </div>
  );
}

const nodeTypes = { custom: CustomNode };

let nodeIdCounter = 0;
const getNextId = () => `node_${++nodeIdCounter}`;

export function WorkflowEditor({ session, isOpen, onClose }: Props) {
  const { locale, setLocale } = useI18n();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [workflowName, setWorkflowName] = useState('');
  const [workflowDescription, setWorkflowDescription] = useState('');
  const [projectType, setProjectType] = useState<ProjectTypeKey>('custom');
  const [isRunning, setIsRunning] = useState(false);
  const [executionResult, setExecutionResult] = useState<{ status: string; creditsUsed?: number; error?: string } | null>(null);
  const [nodeConfigs, setNodeConfigs] = useState<Record<string, Record<string, string>>>({});
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);

  const paletteNodes = getPaletteForType(projectType);

  useEffect(() => {
    if (isOpen && session) loadWorkflows();
  }, [isOpen, session]);

  const onConnect = useCallback((params: Connection) => {
    setEdges((eds) => addEdge({ ...params, animated: true }, eds));
  }, [setEdges]);

  const addNode = (paletteDef: PaletteNodeDef) => {
    const id = getNextId();
    const newNode: Node = {
      id,
      type: 'custom',
      position: { x: 250, y: 100 + nodes.length * 120 },
      data: {
        nodeType: paletteDef.backendType,
        label: paletteDef.label,
        color: paletteDef.color,
        config: { ...(paletteDef.defaultConfig || {}), ...(nodeConfigs[id] || {}) },
        onConfigChange: (key: string, value: string) => {
          setNodeConfigs(prev => ({
            ...prev,
            [id]: { ...(prev[id] || {}), [key]: value },
          }));
        },
        onLabelChange: (label: string) => {
          setNodes((nds) => nds.map(n => n.id === id ? { ...n, data: { ...n.data, label } } : n));
        },
      },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const deleteSelected = () => {
    setNodes((nds) => nds.filter((n) => !(n as Node & { selected?: boolean }).selected));
    setEdges((eds) => eds.filter((e) => !(e.sourceNode as unknown as { selected?: boolean })?.selected && !(e.targetNode as unknown as { selected?: boolean })?.selected));
  };

  const handleSave = async () => {
    if (!workflowName.trim()) return;

    const graph = {
      nodes: nodes.map(n => ({
        id: n.id,
        type: (n.data as Record<string, string>).nodeType,
        label: (n.data as Record<string, string>).label,
        config: nodeConfigs[n.id] || {},
        position: n.position,
      })),
      edges: edges.map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
      })),
    };

    try {
      const method = selectedWorkflowId ? 'PUT' : 'POST';
      const url = selectedWorkflowId
        ? `/api/workflows/${selectedWorkflowId}`
        : '/api/workflows';

      const workflow = await api<Workflow>(url, {
        method,
        body: {
          name: workflowName,
          description: workflowDescription,
          projectType,
          graph,
        },
        token: session.access_token,
      });

      setSelectedWorkflowId(workflow.id);
      setShowSaveModal(false);
      loadWorkflows();
    } catch (err) {
      console.error('Save failed:', err);
    }
  };

  const handleExecute = async () => {
    if (!selectedWorkflowId) {
      alert('Save the workflow first');
      return;
    }

    setIsRunning(true);
    setExecutionResult(null);

    try {
      const data = await api<{ status: string; creditsUsed?: number; error?: string }>(
        `/api/workflows/${selectedWorkflowId}/execute`,
        {
          method: 'POST',
          body: { input: {} },
          token: session.access_token,
        },
      );
      setExecutionResult(data);
    } catch {
      setExecutionResult({ status: 'failed', error: 'Execution failed' });
    } finally {
      setIsRunning(false);
    }
  };

  const loadWorkflows = async () => {
    try {
      const data = await api<Workflow[]>('/api/workflows', { token: session.access_token });
      setWorkflows(data);
    } catch {}
  };

  const loadWorkflow = async (id: string) => {
    try {
      const workflow = await api<Workflow>(`/api/workflows/${id}`, { token: session.access_token });
      setSelectedWorkflowId(workflow.id);
      setWorkflowName(workflow.name);
      setWorkflowDescription(workflow.description || '');

      const wfProjectType = (workflow.projectType as ProjectTypeKey) || 'custom';
      setProjectType(wfProjectType);

      const graph = workflow.graph;
      const loadedNodes: Node[] = graph.nodes.map((n) => {
        const palette = getPaletteForType(wfProjectType);
        const paletteDef = palette.find(p => p.backendType === n.type) || ALL_PALETTE_NODES.find(p => p.backendType === n.type) || ALL_PALETTE_NODES[0];
        return {
          id: n.id,
          type: 'custom',
          position: n.position || { x: 250, y: 100 },
          data: {
            nodeType: n.type,
            label: n.label || paletteDef.label,
            color: paletteDef.color,
            config: n.config || {},
            onConfigChange: (key: string, value: string) => {
              setNodeConfigs(prev => ({
                ...prev,
                [n.id]: { ...(prev[n.id] || {}), [key]: value },
              }));
            },
            onLabelChange: (label: string) => {
              setNodes((nds) => nds.map(node => node.id === n.id ? { ...node, data: { ...node.data, label } } : node));
            },
          },
        };
      });

      const loadedEdges: Edge[] = graph.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
        animated: true,
        style: { stroke: '#64748b' },
      }));

      const configs: Record<string, Record<string, string>> = {};
      for (const n of graph.nodes) {
        if (n.config) configs[n.id] = n.config;
      }
      setNodeConfigs(configs);

      setNodes(loadedNodes);
      setEdges(loadedEdges);
    } catch {}
  };

  if (!isOpen) return null;

  return (
    <div className="workflow-editor-overlay">
      <div className="workflow-editor">
        <div className="wf-toolbar">
          <div className="wf-toolbar-left">
            <input
              className="wf-name-input"
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              placeholder="Workflow name..."
            />
            <select
              className="wf-load-select"
              value={selectedWorkflowId || ''}
              onChange={(e) => e.target.value ? loadWorkflow(e.target.value) : setSelectedWorkflowId(null)}
            >
              <option value="">Load workflow...</option>
              {workflows.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
          <div className="wf-toolbar-right">
            <button className={`flag-btn ${locale === 'en' ? 'active' : ''}`} onClick={() => setLocale('en')} title="English">{'\ud83c\uddec\ud83c\udde7'}</button>
            <button className={`flag-btn ${locale === 'ru' ? 'active' : ''}`} onClick={() => setLocale('ru')} title="Русский">{'\ud83c\uddf7\ud83c\uddfa'}</button>
            <button className="wf-btn wf-btn-save" onClick={() => setShowSaveModal(true)}>
              <Save size={14} /> Save
            </button>
            <button className="wf-btn wf-btn-run" onClick={handleExecute} disabled={isRunning || !selectedWorkflowId}>
              <Play size={14} /> {isRunning ? 'Running...' : 'Run'}
            </button>
            <button className="wf-btn wf-btn-delete" onClick={deleteSelected}>
              <Trash2 size={14} />
            </button>
            <button className="modal-close" onClick={onClose}><X size={18} /></button>
          </div>
        </div>

        <div className="wf-main">
          <div className="wf-sidebar">
            <div className="wf-project-type-row">
              <label className="wf-project-label">Project</label>
              <select
                className="wf-project-select"
                value={projectType}
                onChange={(e) => setProjectType(e.target.value as ProjectTypeKey)}
              >
                {Object.entries(PROJECT_TYPES).map(([key, pt]) => (
                  <option key={key} value={key}>{pt.label}</option>
                ))}
              </select>
            </div>

            <p className="wf-sidebar-title">Node Palette</p>
            {paletteNodes.map((nt, idx) => (
              <button
                key={`${projectType}-${nt.backendType}-${idx}`}
                className="wf-palette-btn"
                onClick={() => addNode(nt)}
                style={{ borderLeftColor: nt.color }}
              >
                {nt.icon}
                <div className="wf-palette-info">
                  <span className="wf-palette-label">{nt.label}</span>
                  <span className="wf-palette-desc">{nt.description}</span>
                </div>
              </button>
            ))}

            {executionResult && (
              <div className="wf-result-panel">
                <p className="wf-sidebar-title">Execution Result</p>
                <div className={`wf-result-status ${executionResult.status}`}>
                  {executionResult.status === 'completed' ? '\u2705 Completed' : '\u274c Failed'}
                </div>
                {executionResult.creditsUsed && (
                  <p className="wf-result-credits">Credits used: {executionResult.creditsUsed}</p>
                )}
                {executionResult.error && (
                  <p className="wf-result-error">{executionResult.error}</p>
                )}
              </div>
            )}
          </div>

          <div className="wf-canvas">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              nodeTypes={nodeTypes}
              fitView
              snapToGrid
              snapGrid={[15, 15]}
            >
              <Controls />
              <Background color="#334155" gap={15} />
            </ReactFlow>
          </div>
        </div>
      </div>

      {showSaveModal && (
        <div className="modal-overlay" onClick={() => setShowSaveModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Save Workflow</h3>
              <button className="modal-close" onClick={() => setShowSaveModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="gen-field">
              <label>Name</label>
              <input className="gen-input" value={workflowName} onChange={(e) => setWorkflowName(e.target.value)} placeholder="My Workflow" />
            </div>
            <div className="gen-field" style={{ marginTop: '0.75rem' }}>
              <label>Description</label>
              <input className="gen-input" value={workflowDescription} onChange={(e) => setWorkflowDescription(e.target.value)} placeholder="What does this workflow do?" />
            </div>
            <div className="gen-field" style={{ marginTop: '0.75rem' }}>
              <label>Project Type</label>
              <select className="gen-input" value={projectType} onChange={(e) => setProjectType(e.target.value as ProjectTypeKey)}>
                {Object.entries(PROJECT_TYPES).map(([key, pt]) => (
                  <option key={key} value={key}>{pt.label}</option>
                ))}
              </select>
            </div>
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setShowSaveModal(false)}>Cancel</button>
              <button className="modal-save" onClick={handleSave}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
