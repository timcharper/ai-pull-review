interface FileData {
  filename: string;
  content: string;
}

interface AnalysisOptions {
  analysisLevel?: 'basic' | 'standard' | 'deep';
  model?: string;
  commentThreshold?: number;
}

type AnalysisLevel = 'basic' | 'standard' | 'deep';

/**
 * Creates the analysis prompt for Claude
 * @param {string} filename - The name of the file
 * @param {string} content - The file content
 * @param {string} analysisLevel - The depth of analysis (basic, standard, deep)
 * @returns {string} The formatted prompt
 */
function createAnalysisPrompt(filename: string, content: string, analysisLevel: AnalysisLevel = 'standard'): string {
  const prompts: Record<AnalysisLevel, string> = {
    basic: `Please analyze this code change and provide basic feedback:
    
    File: ${filename}
    Changes:
    ${content}
    
    Please provide:
    1. Potential issues or bugs
    2. Basic style improvements`,

    standard: `Please analyze this code change and provide feedback:
    
    File: ${filename}
    Changes:
    ${content}
    
    Please provide:
    1. Potential issues or bugs
    2. Style improvements
    3. Performance considerations
    4. Security concerns
    5. Documentation needs`,

    deep: `Please perform a comprehensive analysis of this code change:
    
    File: ${filename}
    Changes:
    ${content}
    
    Please provide detailed feedback on:
    1. Potential bugs, edge cases, and reliability issues
    2. Code style and maintainability improvements
    3. Performance optimizations and scalability considerations
    4. Security vulnerabilities and best practices
    5. Documentation completeness and clarity
    6. Testing coverage and suggestions
    7. Error handling and edge cases
    8. Dependencies and potential issues
    9. Architecture and design patterns
    10. Integration points and API considerations`,
  };

  return prompts[analysisLevel] || prompts.standard;
}

/**
 * Formats the analysis response for GitHub comment
 * @param {string} filename - The name of the file
 * @param {string} analysis - The analysis from Claude
 * @returns {string} Formatted comment body
 */
export function formatAnalysisComment(filename: string, analysis: string): string {
  return `## AI Analysis for ${filename}

${analysis}

---
*Generated using Claude AI - Review and validate all suggestions*`;
}

/**
 * Analyzes a file using the Anthropic API
 * @param {Object} file - File object with filename and content
 * @param {Object} options - Analysis options
 * @returns {Promise<string>} Analysis result
 */
export async function analyzeFile(file: FileData, options: AnalysisOptions = {}): Promise<string> {
  const { analysisLevel = 'standard' } = options;

  try {
    const prompt = createAnalysisPrompt(file.filename, file.content, analysisLevel as AnalysisLevel);
    return prompt;
  } catch (error) {
    console.error(`Error analyzing ${file.filename}: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

export { createAnalysisPrompt };
