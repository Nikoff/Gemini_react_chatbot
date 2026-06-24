import { useState } from 'react';
import { X, ChevronRight, ChevronLeft, MessageSquare, Image, GitBranch, Bot, Store, Coins } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const STEPS = [
  {
    icon: <MessageSquare size={32} />,
    title: 'Welcome to Nikoff AI',
    description: 'Your AI-powered workspace. Chat with advanced models, generate images, build workflows, and deploy AI agents.',
    color: '#3b82f6',
  },
  {
    icon: <MessageSquare size={32} />,
    title: 'Smart Chat',
    description: 'Start a conversation with Gemini or Gemma models. Edit messages, regenerate responses, and use system prompts for custom behavior.',
    color: '#10b981',
  },
  {
    icon: <Image size={32} />,
    title: 'Image Generation',
    description: 'Click the blue Image button (bottom-right) to generate images with ComfyUI. Choose dimensions, steps, and negative prompts.',
    color: '#8b5cf6',
  },
  {
    icon: <GitBranch size={32} />,
    title: 'Workflow Editor',
    description: 'Click the purple GitBranch button to build visual AI pipelines. Drag-and-drop nodes, connect them, and execute multi-step workflows.',
    color: '#f59e0b',
  },
  {
    icon: <Bot size={32} />,
    title: 'AI Agents',
    description: 'Click the green Bot button to create specialized AI agents (Planner, Generator, Editor, QA). Orchestrate multi-agent tasks automatically.',
    color: '#10b981',
  },
  {
    icon: <Store size={32} />,
    title: 'Marketplace',
    description: 'Click the orange Store button to browse community workflows, agent templates, and automation presets. Publish your own creations.',
    color: '#f59e0b',
  },
  {
    icon: <Coins size={32} />,
    title: 'Credits System',
    description: 'You start with 100 credits. Chat costs 1 credit, image generation costs 5-10. Purchase more credit packs anytime.',
    color: '#f59e0b',
  },
];

export function OnboardingTutorial({ isOpen, onClose }: Props) {
  const [step, setStep] = useState(0);

  if (!isOpen) return null;

  const current = STEPS[step];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="onboarding-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}><X size={18} /></button>

        <div className="onboarding-content">
          <div className="onboarding-icon" style={{ color: current.color }}>
            {current.icon}
          </div>
          <h2>{current.title}</h2>
          <p>{current.description}</p>
        </div>

        <div className="onboarding-dots">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`onboarding-dot ${i === step ? 'active' : ''}`}
              onClick={() => setStep(i)}
            />
          ))}
        </div>

        <div className="onboarding-nav">
          <button
            className="onboarding-btn"
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
          >
            <ChevronLeft size={16} /> Back
          </button>
          {step < STEPS.length - 1 ? (
            <button className="onboarding-btn primary" onClick={() => setStep(step + 1)}>
              Next <ChevronRight size={16} />
            </button>
          ) : (
            <button className="onboarding-btn primary" onClick={onClose}>
              Get Started
            </button>
          )}
        </div>

        <button className="onboarding-skip" onClick={onClose}>Skip tour</button>
      </div>
    </div>
  );
}
