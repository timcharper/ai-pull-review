import assert from 'assert';
import { GitProvider, DiffSet, DiffSetEntry } from '../gitProvider';
import { Config, DIFF_STATUS, GitHubConfig } from '../types';
import type { Octokit } from '@octokit/rest' with { 'resolution-mode': 'import' };
import { logger } from '../utils/logger';
import { filterPathsWithGlobAndPrefix, globToRegex, stripPrefix } from '../utils/glob';
import path from 'path';

interface PRDetails {
  headSha: string;
  baseSha: string;
}

function parseRepo(ownerAndRepo: string): { owner: string; repo: string } {
  const [owner, repo] = ownerAndRepo.split('/');
  return { owner, repo };
}

function convertGitHubStatus(status: string): DIFF_STATUS {
  switch (status) {
    case 'added':
      return 'added';
    case 'removed':
      return 'removed';
    case 'modified':
    case 'renamed':
    case 'copied':
    case 'changed':
    case 'unchanged':
    default:
      return 'modified';
  }
}

export class GitHubDiffProvider implements GitProvider {
  constructor(
    private config: Config,
    private githubConfig: GitHubConfig,
    private prDetails: PRDetails,
    private octokit: Octokit,
  ) {}

  static async getInstance(config: Config, octokit?: Octokit): Promise<GitHubDiffProvider> {
    logger.debug('Initializing GitHub provider');
    assert(config.github, 'GitHub config is required');

    if (!octokit) {
      logger.debug('Creating new Octokit instance');
      const OctokitConstructor = await import('@octokit/rest').then((m) => m.Octokit);
      octokit = new OctokitConstructor({ auth: config.github.token });
    }

    const { owner, repo } = parseRepo(config.github.repo);
    logger.debug('Getting PR details', { owner, repo, prNumber: config.github.prNumber });

    // Get PR details
    const { data: pr } = await octokit.pulls.get({
      owner,
      repo,
      pull_number: config.github.prNumber,
    });

    logger.debug('Got PR details', { headSha: pr.head.sha, baseSha: pr.base.sha });

    return new GitHubDiffProvider(
      config,
      config.github,
      {
        headSha: pr.head.sha,
        baseSha: pr.base.sha,
      },
      octokit,
    );
  }

  async getDiff(): Promise<DiffSet> {
    const { repo, prNumber } = this.githubConfig;
    const { owner, repo: repoName } = parseRepo(repo);
    logger.debug('Getting diff for PR', { owner, repo, prNumber });

    // Get PR files
    const { data: files } = await this.octokit.pulls.listFiles({
      owner,
      repo: repoName,
      pull_number: prNumber,
      per_page: 100,
    });

    logger.debug('Got files from PR', { count: files.length });

    // Convert GitHub files to our DiffFile type
    const diffFiles: DiffSetEntry[] = files.map((file) => ({
      filename: file.filename,
      status: convertGitHubStatus(file.status),
      patch: file.patch || '',
    }));

    return {
      files: diffFiles,
      baseSha: this.prDetails.baseSha,
      headSha: this.prDetails.headSha,
    };
  }

  async writeComment(comment: string): Promise<void> {
    const { repo, prNumber } = this.githubConfig;
    const { owner, repo: repoName } = parseRepo(repo);
    logger.debug('Writing PR comment', { owner, repo, prNumber });

    await this.octokit.issues.createComment({
      owner,
      repo: repoName,
      issue_number: prNumber,
      body: comment,
    });

    logger.info('Comment written to PR');
  }

  async getFileContent(filename: string): Promise<string> {
    const { repo } = this.githubConfig;
    const { owner, repo: repoName } = parseRepo(repo);
    logger.debug('Getting file content', { filename, owner, repo });

    try {
      const { data } = await this.octokit.repos.getContent({
        owner,
        repo: repoName,
        path: filename,
        ref: this.prDetails.headSha,
      });

      if ('content' in data) {
        const content = Buffer.from(data.content, 'base64').toString('utf-8');
        logger.debug('Got file content', { filename, size: content.length });
        return content;
      }
      throw new Error(`File ${filename} is not a regular file`);
    } catch (error) {
      console.error(`Error getting file content for ${filename}:`, error);
      return '';
    }
  }

  async listFiles(pathPrefix: string, glob: string): Promise<string[]> {
    const { repo } = this.githubConfig;
    const { owner, repo: repoName } = parseRepo(repo);

    try {
      // Get the tree for the current commit
      const { data: tree } = await this.octokit.git.getTree({
        owner,
        repo: repoName,
        tree_sha: this.prDetails.headSha,
        recursive: '1',
      });

      // Convert glob pattern to regex
      const globRegex = globToRegex(glob);

      return filterPathsWithGlobAndPrefix(
        tree.tree.map((item) => (item.type === 'blob' ? item.path : undefined)),
        pathPrefix,
        glob,
      );
    } catch (error) {
      logger.error(`Error listing files in ${pathPrefix} matching ${glob}:`, error);
      return [];
    }
  }
}
