export const RESUME_PROFILE = {
  owner: 'Nadeem A',
  headline: 'Software Engineer | Full-stack & AI Applications',
  summary:
    'Software engineer in Bengaluru (2025 Information Science graduate) building product and website interfaces at SmiRox. Personal projects span Python/LangChain RAG, Django, Next.js, Kotlin Android, and ESP32 firmware as a hobby.',
  strongSkills: [
    'python',
    'javascript',
    'react',
    'next.js',
    'html',
    'css',
    'django',
    'flask',
    'langchain',
    'rag',
    'llm',
    'generative ai',
    'mysql',
    'rest api',
    'git',
  ],
  supportingSkills: [
    'typescript',
    'node.js',
    'kotlin',
    'android',
    'fastapi',
    'streamlit',
    'pinecone',
    'vector database',
    'openai',
    'prompt engineering',
    'sql',
    'pandas',
    'automation',
    'ci/cd',
  ],
  projects: [
    {
      name: 'legal-ai-rag-assistant',
      summary: 'RAG question-answering over legal documents - Python, LangChain, OpenAI embeddings, Pinecone, Streamlit.',
    },
    {
      name: 'book_store',
      summary: 'Django bookstore with session-based cart and checkout; includes privacy fixes and regression tests.',
    },
    {
      name: 'Dreamlock',
      summary: 'Kotlin Android app that estimates reels/shorts scrolling time via the Accessibility API.',
    },
    {
      name: 'super-watch',
      summary: 'ESP32-C3 watch firmware handling iPhone notifications over BLE ANCS (C/C++).',
    },
    {
      name: 'nadeem',
      summary: 'Personal portfolio site - HTML/CSS/JS with a service worker, at n4deem.site.',
    },
  ],
  targetRoles: [
    'software engineer',
    'associate software engineer',
    'full stack developer',
    'frontend developer',
    'python developer',
    'ai engineer',
    'generative ai engineer',
  ],
  entryLevelSignals: [
    'entry level',
    'entry-level',
    'associate',
    'graduate',
    'early professional',
    'fresher',
    'new grad',
    'intern',
    'internship',
    'junior',
    'campus',
    'trainee',
    '0-1 years',
    '0-2 years',
  ],
};

// Roles in these spaces are never a match, whatever the score.
export const EXCLUDED_TERMS = [
  'gambling',
  'betting',
  'sportsbook',
  'casino',
  'real money gaming',
  'real-money gaming',
  'rummy',
  'poker',
  'fantasy sports',
  'lottery',
  'igaming',
  'i-gaming',
  'wagering',
];

export const DEFAULT_KEYWORDS = [
  'software engineer',
  'python developer',
  'full stack developer',
  'frontend developer',
  'generative ai',
  'ai engineer',
];

export const DEFAULT_LOCATIONS = [
  'Bengaluru',
  'Bangalore',
  'Remote',
  'India',
];
