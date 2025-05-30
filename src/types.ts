export type DIFF_STATUS = 'added' | 'modified' | 'removed';

export interface FileData {
  filename: string;
  change: string;
  originalContent: string;
  changes: string;
  status: DIFF_STATUS;
}

export interface AnalysisOptions {
  model: string;
  maxTokens: number;
  temperature?: number;
  maxRetries?: number;
  retryDelay?: number;
  commentThreshold?: number;
}

export interface GitHubConfig {
  token: string;
  repo: string;
  prNumber: number;
}

export interface LocalGitConfig {
  baseSha: string;
  headSha: string;
}

export interface Config {
  afterLines: number;
  beforeLines: number;
  anthropicApiKey: string;
  model: string;
  include: string[];
  exclude: string[];
  maxFiles: number;
  maxSize: number;
  commentThreshold: number;
  writePullRequest: boolean;
  output: string;
  dryRun: boolean;
  workingDir: string;
  mode: 'github' | 'localgit';
  github?: GitHubConfig;
  localgit?: LocalGitConfig;
}

export interface FileObject {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
}

export interface FilterOptions {
  includePatterns: string[];
  excludePatterns: string[];
  maxFiles: number;
}

export interface Message {
  role: MessageRole;
  content: string;
}

export interface BatchResult {
  fileName: string;
  content: string;
}

export interface ModelCost {
  model: string;
  cost: number;
}

export type MessageRole = 'user' | 'assistant';

export interface MessageParam {
  role: MessageRole;
  content: string;
}
