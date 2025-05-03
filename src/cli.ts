#!/usr/bin/env ts-node

import 'dotenv/config';
import { program } from 'commander';
import { analyzePR } from './index';
import { version } from '../package.json';
import { Config, AnalysisLevel } from './types';
import { execSync } from 'child_process';
import { DEFAULT_MODEL } from './config';
import { resolve } from 'path';

function getDefaultBranch(cwd: string): string {
  try {
    // Try to get the default branch from origin/HEAD
    const defaultBranch = execSync('git symbolic-ref refs/remotes/origin/HEAD', {
      encoding: 'utf8',
      cwd,
    })
      .trim()
      .replace('refs/remotes/origin/', '');
    return defaultBranch;
  } catch (error) {
    // Fallback to common branch names
    const commonBranches = ['main', 'master'];
    for (const branch of commonBranches) {
      try {
        execSync(`git show-ref --verify --quiet refs/remotes/origin/${branch}`, { cwd });
        return branch;
      } catch {
        continue;
      }
    }
    // If all else fails, use HEAD~1 as a safe default
    return 'HEAD~1';
  }
}

program
  .name('ai-pull-review-cli')
  .description('AI-powered pull request analysis')
  .version(version)
  .option('-C, --directory <dir>', 'Change to directory before performing any operations')
  .option('-m, --mode <mode>', 'Analysis mode (github or localgit)', 'localgit')
  .option('-p, --pr <number>', 'Pull request number (required for github mode)')
  .option('-r, --repo <owner/repo>', 'Repository (required for github mode)')
  .option('-t, --token <token>', 'GitHub token (required for github mode)', process.env.GITHUB_TOKEN)
  .option('-k, --key <key>', 'Anthropic API key', process.env.ANTHROPIC_API_KEY)
  .option('-l, --level <level>', 'Analysis level (basic, standard, deep)', 'basic')
  .option('--model <model>', 'Claude model to use', DEFAULT_MODEL)
  .option('--include <patterns>', 'File patterns to include (comma-separated)')
  .option(
    '--exclude <patterns>',
    'File patterns to exclude (comma-separated)',
    '**/node_modules/**, **/dist/**, **/build/**, **/bin/**, **/artifacts/**',
  )
  .option('--max-files <number>', 'Maximum files to analyze', '50')
  .option('--max-size <number>', 'Maximum file size in KB', '100')
  .option('--threshold <number>', 'Comment confidence threshold', '0.6')
  .option('--write-pull-request', 'Write the analysis to the pull request as a comment')
  .option('-o, --output <folder>', 'Output folder for results')
  .option('--base-sha <sha>', 'Base SHA or branch for local Git diff (defaults to mainline branch)')
  .option('--head-sha <sha>', 'Head SHA for local Git diff', 'HEAD')
  .option('--dry-run', 'Show the prompt without sending to the model');

program.parse();

const options = program.opts();

// Change to specified directory if provided
const workingDir = options.directory ? resolve(options.directory) : process.cwd();
if (options.directory) {
  try {
    process.chdir(workingDir);
  } catch (error) {
    console.error(`Error: Could not change to directory ${workingDir}:`, error);
    process.exit(1);
  }
}

// Validate required inputs
if (!options.key) {
  console.error('Error: Anthropic API key is required. Set ANTHROPIC_API_KEY env var or use --key');
  process.exit(1);
}

const mode = options.mode === 'localgit' ? 'localgit' : 'github';

// Validate mode-specific requirements
if (mode === 'github') {
  if (!options.token) {
    console.error('Error: GitHub token is required for github mode. Set GITHUB_TOKEN env var or use --token');
    process.exit(1);
  }
  if (!options.repo) {
    console.error('Error: Repository is required for github mode. Use -r, --repo <owner/repo>');
    process.exit(1);
  }
  if (!options.pr) {
    console.error('Error: Pull request number is required for github mode. Use -p, --pr <number>');
    process.exit(1);
  }
}

// Convert options to config object
const config: Config = {
  anthropicApiKey: options.key,
  model: options.model,
  analysisLevel: options.level as AnalysisLevel,
  include: options.include?.split(',').map((p: string) => p.trim()) || [],
  exclude: options.exclude?.split(',').map((p: string) => p.trim()) || [],
  maxFiles: parseInt(options.maxFiles, 10),
  maxSize: parseInt(options.maxSize, 10),
  commentThreshold: parseFloat(options.threshold),
  writePullRequest: !!options.writePullRequest,
  output: options.output,
  dryRun: !!options.dryRun,
  workingDir,
  mode,
  ...(mode === 'github'
    ? {
        github: {
          token: options.token,
          repo: options.repo,
          prNumber: parseInt(options.pr, 10),
        },
      }
    : {
        localgit: {
          baseSha: options.baseSha || getDefaultBranch(workingDir),
          headSha: options.headSha,
        },
      }),
};

analyzePR(config)
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error('Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  });
