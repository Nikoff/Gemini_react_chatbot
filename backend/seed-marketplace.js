const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const VIDEO_FACTORY_PIPELINE = {
  name: 'AI Video Factory',
  description: 'Automatically creates a video from a text prompt. Pipeline: Script -> Storyboard -> Key Frames -> Voiceover -> Assembly',
  type: 'workflow',
  category: 'video',
  price: 0,
  tags: ['video', 'automation', 'ai', 'factory', 'pipeline'],
  content: {
    nodes: [
      {
        id: 'node_1',
        type: 'input',
        position: { x: 50, y: 200 },
        config: { defaultValue: 'A cinematic sci-fi trailer with dramatic music' },
      },
      {
        id: 'node_2',
        type: 'text_gen',
        position: { x: 300, y: 50 },
        config: {
          prompt: 'Write a detailed video script (5 scenes) for: {{input}}. Each scene should have: scene_number, title, description, narration, duration_seconds.',
        },
      },
      {
        id: 'node_3',
        type: 'text_gen',
        position: { x: 300, y: 200 },
        config: {
          prompt: 'Create a visual storyboard for each scene. For each scene provide: shot_type (wide/medium/close-up), camera_movement, mood, color_palette, key_elements.',
        },
      },
      {
        id: 'node_4',
        type: 'text_gen',
        position: { x: 300, y: 350 },
        config: {
          prompt: 'Generate detailed image generation prompts for each scene in the storyboard. Format as a numbered list of prompts suitable for AI image generators.',
        },
      },
      {
        id: 'node_5',
        type: 'text_gen',
        position: { x: 600, y: 200 },
        config: {
          prompt: 'Create a narration script with timestamps for each scene. Include pacing notes, emphasis markers, and estimated word counts per scene.',
        },
      },
      {
        id: 'node_6',
        type: 'text_gen',
        position: { x: 900, y: 200 },
        config: {
          prompt: 'Create a final production package combining: 1) Scene breakdown with timing, 2) Visual style guide, 3) Audio cues, 4) Transition notes. Format as a professional production document.',
        },
      },
      {
        id: 'node_7',
        type: 'output',
        position: { x: 1200, y: 200 },
        config: {},
      },
    ],
    edges: [
      { id: 'e1_2', source: 'node_1', target: 'node_2', sourceHandle: 'output', targetHandle: 'input' },
      { id: 'e1_3', source: 'node_1', target: 'node_3', sourceHandle: 'output', targetHandle: 'input' },
      { id: 'e1_4', source: 'node_1', target: 'node_4', sourceHandle: 'output', targetHandle: 'input' },
      { id: 'e2_5', source: 'node_2', target: 'node_5', sourceHandle: 'output', targetHandle: 'input' },
      { id: 'e3_5', source: 'node_3', target: 'node_5', sourceHandle: 'output', targetHandle: 'input' },
      { id: 'e4_5', source: 'node_4', target: 'node_5', sourceHandle: 'output', targetHandle: 'input' },
      { id: 'e5_6', source: 'node_5', target: 'node_6', sourceHandle: 'output', targetHandle: 'input' },
      { id: 'e6_7', source: 'node_6', target: 'node_7', sourceHandle: 'output', targetHandle: 'input' },
    ],
  },
};

const MARKETPLACE_ITEMS = [
  {
    name: 'Blog Post Generator',
    description: 'Generates a complete blog post from a topic. Includes outline, draft, editing pass, and SEO optimization.',
    type: 'workflow',
    category: 'content',
    price: 0,
    tags: ['blog', 'content', 'writing', 'seo'],
    content: {
      nodes: [
        { id: 'n1', type: 'input', position: { x: 50, y: 200 }, config: { defaultValue: 'Your topic here' } },
        { id: 'n2', type: 'text_gen', position: { x: 350, y: 100 }, config: { prompt: 'Create a detailed outline for a blog post about: {{input}}. Include title, headings, and key points.' } },
        { id: 'n3', type: 'text_gen', position: { x: 650, y: 100 }, config: { prompt: 'Write a full blog post following this outline. Be engaging and informative.\n\n{{input}}' } },
        { id: 'n4', type: 'editor', position: { x: 950, y: 100 }, config: { prompt: 'Edit and improve this blog post for clarity, engagement, and readability:\n\n{{input}}' } },
        { id: 'n5', type: 'output', position: { x: 1250, y: 200 }, config: {} },
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2', sourceHandle: 'output', targetHandle: 'input' },
        { id: 'e2', source: 'n2', target: 'n3', sourceHandle: 'output', targetHandle: 'input' },
        { id: 'e3', source: 'n3', target: 'n4', sourceHandle: 'output', targetHandle: 'input' },
        { id: 'e4', source: 'n4', target: 'n5', sourceHandle: 'output', targetHandle: 'input' },
      ],
    },
  },
  {
    name: 'Code Review Agent',
    description: 'AI-powered code review. Paste code, get a structured review with issues, suggestions, and improvements.',
    type: 'agent_template',
    category: 'development',
    price: 10,
    tags: ['code', 'review', 'development', 'qa'],
    content: {
      agentType: 'qa',
      systemPrompt: 'You are a senior code reviewer. Analyze the provided code for: bugs, performance issues, security vulnerabilities, code style, and best practices. Provide a structured review with severity levels.',
    },
  },
  {
    name: 'Social Media Pack',
    description: 'Generate posts for Twitter, LinkedIn, and Instagram from a single topic. Includes hashtags and engagement hooks.',
    type: 'automation_template',
    category: 'marketing',
    price: 5,
    tags: ['social', 'marketing', 'content', 'automation'],
    content: {
      nodes: [
        { id: 'n1', type: 'input', position: { x: 50, y: 200 }, config: { defaultValue: 'Your topic' } },
        { id: 'n2', type: 'text_gen', position: { x: 350, y: 50 }, config: { prompt: 'Create a Twitter thread (5 tweets) about: {{input}}. Include hashtags and hooks.' } },
        { id: 'n3', type: 'text_gen', position: { x: 350, y: 200 }, config: { prompt: 'Write a LinkedIn post about: {{input}}. Professional tone, include insights.' } },
        { id: 'n4', type: 'text_gen', position: { x: 350, y: 350 }, config: { prompt: 'Create an Instagram caption with emojis and hashtags about: {{input}}.' } },
        { id: 'n5', type: 'output', position: { x: 700, y: 200 }, config: {} },
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2', sourceHandle: 'output', targetHandle: 'input' },
        { id: 'e2', source: 'n1', target: 'n3', sourceHandle: 'output', targetHandle: 'input' },
        { id: 'e3', source: 'n1', target: 'n4', sourceHandle: 'output', targetHandle: 'input' },
        { id: 'e4a', source: 'n2', target: 'n5', sourceHandle: 'output', targetHandle: 'input' },
        { id: 'e4b', source: 'n3', target: 'n5', sourceHandle: 'output', targetHandle: 'input' },
        { id: 'e4c', source: 'n4', target: 'n5', sourceHandle: 'output', targetHandle: 'input' },
      ],
    },
  },
];

async function seed() {
  console.log('Seeding marketplace items...');

  try {
    for (const item of MARKETPLACE_ITEMS) {
      const existing = await prisma.marketplaceItem.findFirst({ where: { name: item.name } });
      if (!existing) {
        await prisma.marketplaceItem.create({
          data: {
            userId: 'system',
            name: item.name,
            description: item.description,
            type: item.type,
            category: item.category,
            price: item.price,
            content: item.content,
            tags: item.tags,
            status: 'published',
          },
        });
        console.log(`  Created: ${item.name}`);
      } else {
        console.log(`  Already exists: ${item.name}`);
      }
    }

    console.log('Seed complete!');
  } catch (err) {
    console.error('Seed failed:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
