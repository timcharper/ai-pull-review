import * as core from '@actions/core';
import { getConfigFromInputs } from './config';
import { analyzePR } from './index';

async function run(): Promise<void> {
  try {
    const config = getConfigFromInputs();
    await analyzePR(config);
    core.info('Analysis complete');
  } catch (error) {
    if (error instanceof Error) {
      core.error(error.message);
      core.debug(error.stack || 'No stack trace available');
      core.setFailed(error.message);
    } else {
      core.error('An unknown error occurred');
      core.setFailed('An unknown error occurred');
    }
    process.exit(1);
  }
}

run();
