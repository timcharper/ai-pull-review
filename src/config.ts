import { Config } from './types';

export const DEFAULT_MODEL = 'claude-3-7-sonnet-20250219';

export const defaultConfig = {
  model: DEFAULT_MODEL,
  analysisLevel: 'standard',
  commentThreshold: 0.7,
  maxFiles: 10,
  maxSize: 100,
  filePatterns: ['**/*.{js,jsx,ts,tsx,py,java,rb,go,rs}'],
  excludePatterns: ['**/node_modules/**', '**/dist/**', '**/build/**'],
  writePullRequest: true,
  output: 'results',
} as const;
