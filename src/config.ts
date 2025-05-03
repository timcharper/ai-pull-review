import * as core from '@actions/core';
import * as github from '@actions/github';
import { Config, GitHubConfig, LocalGitConfig } from './types';
import { inferMainlineBranch } from './gitProviders/localgit';

interface DefaultConfig {
  model: string;
  analysisLevel: string;
  commentThreshold: number;
  maxFiles: number;
  maxSize: number;
  filePatterns: string[];
  excludePatterns: string[];
  writePullRequest: boolean;
  output: string;
}

export const DEFAULT_MODEL = 'claude-3-7-sonnet-20250219';

const defaultConfig: DefaultConfig = {
  model: DEFAULT_MODEL,
  analysisLevel: 'standard',
  commentThreshold: 0.7,
  maxFiles: 10,
  maxSize: 100,
  filePatterns: ['**/*.{js,jsx,ts,tsx,py,java,rb,go,rs}'],
  excludePatterns: ['**/node_modules/**', '**/dist/**', '**/build/**'],
  writePullRequest: true,
  output: 'results',
};

export function getConfigFromInputs(): Config {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  const prNumber = process.env.GITHUB_PULL_REQUEST_NUMBER;
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  const workingDir = process.cwd();

  if (!anthropicApiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required');
  }

  let mode: 'github' | 'localgit';
  let githubConfig: GitHubConfig | undefined;
  let localgitConfig: LocalGitConfig | undefined;
  switch (process.env.MODE) {
    case 'github':
      mode = 'github';
      if (!token || !repo || !prNumber) {
        throw new Error(
          'GITHUB_TOKEN, GITHUB_REPOSITORY, and GITHUB_PULL_REQUEST_NUMBER environment variables are required',
        );
      }
      githubConfig = {
        token,
        repo,
        prNumber: parseInt(prNumber, 10),
      };
      break;
    case 'localgit':
      mode = 'localgit';
      localgitConfig = {
        baseSha: inferMainlineBranch(workingDir),
        headSha: 'HEAD',
      };
      break;
    default:
      throw new Error('MODE environment variable must be either "github" or "localgit"');
  }

  return {
    anthropicApiKey,
    model: DEFAULT_MODEL,
    analysisLevel: 'standard',
    include: [],
    exclude: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/bin/**', '**/artifacts/**'],
    maxFiles: 10,
    maxSize: 100,
    commentThreshold: 0.6,
    writePullRequest: true,
    output: 'results',
    workingDir,
    mode,
    github: githubConfig,
    localgit: localgitConfig,
  };
}

export { defaultConfig };
