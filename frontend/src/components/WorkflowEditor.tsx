import { useState, useCallback, useRef } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  addEdge,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  type Connection,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { X, Play, Save, Plus, Trash2, FileText, Image, Wand2, ArrowRight, Square } from 'lucide-react';
import { useI18n } from '../context/I18nContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const NODE_TYPES_CONFIG = [
  { type: 'input', label: 'Input', icon: <Plus size={14} />, color: '#10b981', description: 'Provide input data' },
  { type: 'text_gen', label: 'Text Generation', icon: <FileText size={14} />, color: '#3b82f6', description: 'Generate text with AI' },
  { type: 'image_gen', label: 'Image Generation', icon: <Image size={14} />, color: '#8b5cf6', description: 'Generate image with ComfyUI' },
  { type: 'transform', label: 'Transform', icon: <Wand2 size={14} />, color: '#f59e0b', description: 'Transform data with template' },
  { type: 'output', label: 'Output', icon: <Square size={14} />, color: '#ef4444', description: 'Output result' },
];

interface Props {
  session: any;
  isOpen: boolean;
  onClose: () => void;
}

function CustomNode({ data }: { data: any }) {
  const config = NODE_TYPES_CONFIG.find(n => n.type === data.nodeType) || NODE_TYPES_CONFIG[0];

  return (
    <div className="workflow-node" style={{ borderColor: config.color }}>
      <Handle type="target" position={Position.Left} style={{ background: config.color }} />
      <div className="workflow-node-header" style={{ background: config.color }}>
        {config.icon}
        <span>{data.label || config.label}</span>
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
      <Handle type="source" position={Position.Right} style={{ background: config.color }} />
    </div>
  );
}

const nodeTypes = { custom: CustomNode };

let nodeIdCounter = 0;
const getNextId = () => `node_${++nodeIdCounter}`;

export function WorkflowEditor({ session, isOpen, onClose }: Props) {
  const { t } = useI18n();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [workflowName, setWorkflowName] = useState('');
  const [workflowDescription, setWorkflowDescription] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [executionResult, setExecutionResult] = useState<any>(null);
  const [nodeConfigs, setNodeConfigs] = useState<Record<string, any>>({});
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);

  const onConnect = useCallback((params: Connection) => {
    setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#64748b' } }, eds));
  }, [setEdges]);

  const addNode = (type: string) => {
    const config = NODE_TYPES_CONFIG.find(n => n.type === type) || NODE_TYPES_CONFIG[0];
    const id = getNextId();
    const newNode: Node = {
      id,
      type: 'custom',
      position: { x: 250, y: 100 + nodes.length * 120 },
      data: {
        nodeType: type,
        label: config.label,
        config: nodeConfigs[id] || {},
        onConfigChange: (key: string, value: string) => {
          setNodeConfigs(prev => ({
            ...prev,
            [id]: { ...(prev[id] || {}), [key]: value },
          }));
        },
      },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const deleteSelected = () => {
    setNodes((nds) => nds.filter((n) => !n.selected));
    setEdges((eds) => eds.filter((e) => !e.sourceNode?.selected && !e.targetNode?.selected));
  };

  const handleSave = async () => {
    if (!workflowName.trim()) return;

    const graph = {
      nodes: nodes.map(n => ({
        id: n.id,
        type: n.data.nodeType,
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
        ? `${API_URL}/api/workflows/${selectedWorkflowId}`
        : `${API_URL}/api/workflows`;

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name: workflowName,
          description: workflowDescription,
          graph,
        }),
      });

      if (res.ok) {
        const workflow = await res.json();
        setSelectedWorkflowId(workflow.id);
        setShowSaveModal(false);
        loadWorkflows();
      }
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
      const res = await fetch(`${API_URL}/api/workflows/${selectedWorkflowId}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ input: {} }),
      });

      const data = await res.json();
      setExecutionResult(data);
    } catch (err) {
      setExecutionResult({ status: 'failed', error: 'Execution failed' });
    } finally {
      setIsRunning(false);
    }
  };

  const loadWorkflows = async () => {
    try {
      const res = await fetch(`${API_URL}/api/workflows`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
      if (res.ok) setWorkflows(await res.json());
    } catch {}
  };

  const loadWorkflow = async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/api/workflows/${id}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const workflow = await res.json();
        setSelectedWorkflowId(workflow.id);
        setWorkflowName(workflow.name);
        setWorkflowDescription(workflow.description || '');

        const graph = workflow.graph;
        const loadedNodes: Node[] = graph.nodes.map((n: any) => ({
          id: n.id,
          type: 'custom',
          position: n.position || { x: 250, y: 100 },
          data: {
            nodeType: n.type,
            label: NODE_TYPES_CONFIG.find(c => c.type === n.type)?.label || n.type,
            config: n.config || {},
            onConfigChange: (key: string, value: string) => {
              setNodeConfigs(prev => ({
                ...prev,
                [n.id]: { ...(prev[n.id] || {}), [key]: value },
              }));
            },
          },
        }));

        const loadedEdges: Edge[] = graph.edges.map((e: any) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle,
          targetHandle: e.targetHandle,
          animated: true,
          style: { stroke: '#64748b' },
        }));

        const configs: Record<string, any> = {};
        for (const n of graph.nodes) {
          if (n.config) configs[n.id] = n.config;
        }
        setNodeConfigs(configs);

        setNodes(loadedNodes);
        setEdges(loadedEdges);
      }
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
            <p className="wf-sidebar-title">Node Palette</p>
            {NODE_TYPES_CONFIG.map((nt) => (
              <button
                key={nt.type}
                className="wf-palette-btn"
                onClick={() => addNode(nt.type)}
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
