# AI Pull Request Analysis

A powerful tool for automated code review powered by Anthropic's Claude AI. Available both as a GitHub Action and as an NPM package for CLI usage.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![NPM Version](https://img.shields.io/npm/v/@diekotto/ai-pull-review-cli.svg)](https://www.npmjs.com/package/@diekotto/ai-pull-review-cli)
[![Node Version](https://img.shields.io/node/v/@diekotto/ai-pull-review-cli.svg)](https://www.npmjs.com/package/@diekotto/ai-pull-review-cli)

## Features

- Automated code review using Claude AI
- Detection of potential bugs and vulnerabilities
- Style and consistency checking
- Documentation assessment
- Performance impact analysis
- Security best practices verification
- Cost estimation and tracking
- Flexible file filtering
- Supports multiple analysis levels
- Available as both GitHub Action and CLI tool

## Usage Options

### 1. GitHub Action

#### Prerequisites

1. Anthropic API key (obtain from [Anthropic's website](https://anthropic.com))
2. GitHub repository with pull request workflows enabled

#### Installation

1. Create `.github/workflows/pr-analysis.yml`:

```yaml
name: PR Analysis
on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  analyze:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write

    steps:
      - uses: actions/checkout@v4
      - name: AI Pull Request Analysis
        uses: diekotto/ai-pull-review@v2
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          github_token: ${{ secrets.GITHUB_TOKEN }}
```

2. Add your Anthropic API key to repository secrets:
   - Repository settings → Secrets and Variables → Actions
   - Create new secret: `ANTHROPIC_API_KEY`
   - Add your API key as the value

### 2. CLI Usage

The tool is also available as an NPM package for command-line usage.

#### Installation

```bash
# Global installation
npm install -g @diekotto/ai-pull-review-cli

# Or run directly with npx
npx @diekotto/ai-pull-review-cli
```

#### CLI Options

```bash
Usage: ai-pull-review-cli [options]

Options:
  -V, --version                       output the version number
  -p, --pr <number>                   Pull request number (required)
  -r, --repo <owner/repo>            Repository (required)
  -t, --token <token>                GitHub token (default: GITHUB_TOKEN env)
  -k, --key <key>                    Anthropic API key (default: ANTHROPIC_API_KEY env)
  -l, --level <level>                Analysis level (basic, standard, deep) (default: "basic")
  -m, --model <model>                Claude model to use (default: "claude-3-5-haiku-20241022")
  --file-patterns <patterns>         File patterns to include (comma-separated)
  --exclude-patterns <patterns>      File patterns to exclude (default: "**/node_modules/**, **/dist/**, **/build/**, **/bin/**, **/artifacts/**")
  --max-files <number>              Maximum files to analyze (default: "10")
  --max-size <number>               Maximum file size in KB (default: "100")
  --threshold <number>              Comment confidence threshold (default: "0.6")
  --write-pull-request              Write the analysis to the pull request as a comment
  -o, --output <folder>             Output folder for results (default: "results")
  -h, --help                        display help for command
```

#### Example Usage

```bash
# Using environment variables
export GITHUB_TOKEN=your_github_token
export ANTHROPIC_API_KEY=your_anthropic_key

# Analyze a specific PR
ai-pull-review-cli -p 123 -r owner/repo -l deep

# Or with npx
npx ai-pull-review-cli -p 123 -r owner/repo -l deep
```

## Configuration

### Analysis Levels

- `basic`: Quick analysis focusing on bugs and style issues
- `standard`: Comprehensive analysis including performance and security
- `deep`: In-depth analysis including architecture, testing, and broader implications

### Available Models

The tool supports various Claude models with different capabilities and pricing:

- `claude-3-5-sonnet-20241022` (Default for accuracy)
- `claude-3-5-haiku-20241022` (Default for speed)
- `claude-3-opus-20240229` (Most capable)

### GitHub Action Configuration

Complete configuration options for your workflow file:

```yaml
- uses: diekotto/ai-pull-review@v2
  with:
    # Required
    anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
    github_token: ${{ secrets.GITHUB_TOKEN }}

    # Optional
    file_patterns: '**/*.js,**/*.jsx,**/*.ts,**/*.tsx,**/*.py,**/*.java,**/*.rb,**/*.go,**/*.rs' # Files to analyze
    exclude_patterns: '**/node_modules/**,**/dist/**,**/bin/**' # Files to exclude
    max_files: '10' # Maximum files to analyze
    max_size: '100' # Maximum file size in KB
    comment_threshold: '0.7' # Minimum confidence for comments
    analysis_level: 'basic' # basic, standard, or deep
    model: 'claude-3-5-haiku-20241022' # Claude model to use
```

### Advanced Example

Configuration focusing on JavaScript analysis with deep inspection:

```yaml
name: Deep JS Analysis
on:
  pull_request:
    paths:
      - '**.js'
      - '**.jsx'
      - '**.ts'
      - '**.tsx'

jobs:
  analyze:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write

    steps:
      - uses: actions/checkout@v4
      - name: AI Pull Request Analysis
        uses: diekotto/ai-pull-review@v2
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          github_token: ${{ secrets.GITHUB_TOKEN }}
          file_patterns: '**/*.js,**/*.jsx,**/*.ts,**/*.tsx'
          exclude_patterns: '**/node_modules/**,**/dist/**,**/*.test.js'
          analysis_level: 'deep'
          max_files: '15'
          comment_threshold: '0.6'
          model: 'claude-3-5-sonnet-20241022'
```

## Error Handling and Limitations

- Files exceeding size or complexity limits are automatically skipped
- Warnings are logged for problematic files
- Analysis continues with remaining files when encountering issues
- Detailed error reporting in GitHub Actions log
- Cost tracking and estimation for API usage

## Requirements

- Node.js >= 22.0.0
- Yarn >= 1.22.0

## License

MIT License - see the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.
