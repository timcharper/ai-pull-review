import { execSync } from 'child_process';
import { GitProvider, DiffSet, DiffSetEntry } from '../gitProvider';
import { Config, LocalGitConfig, DIFF_STATUS, CommitMessage } from '../types';
import { minimatch } from 'minimatch';
import assert from 'assert';
import { logger } from '../utils/logger';
import { filterPathsWithGlobAndPrefix, globToRegex } from '../utils/glob';

export function inferMainlineBranch(cwd: string): string {
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

export class LocalGitDiffProvider implements GitProvider {
  constructor(
    private config: Config,
    private localgitConfig: LocalGitConfig,
  ) {}

  static async getInstance(config: Config): Promise<LocalGitDiffProvider> {
    assert(config.localgit, 'LocalGit config is required');
    return new LocalGitDiffProvider(config, config.localgit);
  }

  async getDiff(): Promise<DiffSet> {
    const { baseSha, headSha } = this.localgitConfig;

    // Get the diff between the two commits
    const cmd = `git diff ${baseSha}...${headSha}`;
    logger.debug('Running command:', cmd);
    const diffOutput = execSync(cmd, {
      encoding: 'utf8',
      cwd: this.config.workingDir,
    });

    // Parse the diff output into files
    const files: DiffSetEntry[] = [];
    let currentFile: Partial<DiffSetEntry> = {};

    for (const line of diffOutput.split('\n')) {
      if (line.startsWith('diff --git')) {
        if (currentFile.filename) {
          files.push(currentFile as DiffSetEntry);
        }
        const parts = line.split(' ');
        const filepath = parts[2]?.replace('a/', '');
        if (filepath) {
          currentFile = {
            filename: filepath,
            status: 'modified',
            patch: '',
          };
        }
      } else if (currentFile.filename) {
        currentFile.patch = (currentFile.patch || '') + line + '\n';
      }
    }

    if (currentFile.filename) {
      files.push(currentFile as DiffSetEntry);
    }

    return {
      files,
      baseSha,
      headSha,
    };
  }

  async writeComment(comment: string): Promise<void> {
    // For local Git, we'll just print the comment to stdout
    console.log('=== Analysis Results ===');
    console.log(comment);
    console.log('=======================');
  }

  async getFileContent(filename: string): Promise<string> {
    try {
      return execSync(`git show ${this.localgitConfig.headSha}:${filename}`, {
        encoding: 'utf8',
        cwd: this.config.workingDir,
      });
    } catch (error) {
      console.error(`Error getting file content for ${filename}:`, error);
      return '';
    }
  }

  async listFiles(path: string, glob: string): Promise<string[]> {
    try {
      // List all files in the repo
      const allFiles = execSync('git ls-files', {
        encoding: 'utf8',
        cwd: this.config.workingDir,
      })
        .split('\n')
        .filter(Boolean);

      return filterPathsWithGlobAndPrefix(allFiles, path, glob);
    } catch (error) {
      logger.error(`Error listing files in ${path} matching ${glob}:`, error);
      return [];
    }
  }

  async getCommitMessages(baseSha: string, headSha: string): Promise<CommitMessage[]> {
    try {
      const cmd = `git log ${baseSha}..${headSha} --pretty=format:"%H|%an|%ad|%s" --date=iso`;
      logger.debug('Getting commit messages with command:', cmd);

      const output = execSync(cmd, {
        encoding: 'utf8',
        cwd: this.config.workingDir,
      });

      if (!output.trim()) {
        return [];
      }

      const commits: CommitMessage[] = output
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const [sha, author, date, ...messageParts] = line.split('|');
          return {
            sha: sha || '',
            author: author || '',
            date: date || '',
            message: messageParts.join('|') || '',
          };
        });

      logger.debug('Found commit messages:', commits.length);
      return commits;
    } catch (error) {
      logger.error('Error getting commit messages:', error);
      return [];
    }
  }
}
