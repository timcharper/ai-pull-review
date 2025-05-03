import { Anthropic } from '@anthropic-ai/sdk';
import { BatchResult, MessageParam, AnalysisOptions } from './types';

export class AnthropicBatchManager {
  private client: Anthropic;
  private messages: MessageParam[] = [];
  private batchResults: BatchResult[] = [];

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async sendBatch(messages: MessageParam[], options: AnalysisOptions): Promise<BatchResult[]> {
    try {
      const response = await this.client.messages.create({
        model: options.model,
        max_tokens: options.maxTokens,
        temperature: options.temperature,
        messages: messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
      });

      if (!response.content || !Array.isArray(response.content)) {
        throw new Error('Invalid response format from Anthropic API');
      }

      const content = response.content[0];
      if (!content || content.type !== 'text') {
        throw new Error('Unexpected content type from Anthropic API');
      }

      const result: BatchResult = {
        fileName: 'analysis',
        content: content.text,
      };

      this.batchResults.push(result);
      return [result];
    } catch (error) {
      console.error('Error sending batch to Anthropic:', error);
      throw error;
    }
  }

  async calculateTokenPrices(model: string): Promise<number> {
    // This is a simplified version - in a real implementation, you'd want to
    // calculate actual token usage and costs based on the model's pricing
    const modelCosts: Record<string, number> = {
      'claude-3-5-haiku-20241022': 0.00025,
      'claude-3-5-sonnet-20241022': 0.003,
      'claude-3-5-opus-20241022': 0.015,
    };

    const cost = modelCosts[model] || 0.00025; // Default to haiku pricing
    return cost;
  }

  async wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
