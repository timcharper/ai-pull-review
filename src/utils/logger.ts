export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private level: LogLevel;

  constructor() {
    this.level = (process.env.LOG_LEVEL as LogLevel) || 'info';
  }

  private shouldLog(messageLevel: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(messageLevel) >= levels.indexOf(this.level);
  }

  private formatMessage(level: string, message: string, ...args: any[]): string {
    let result = `[${level}] ${message}`;
    if (args.length > 0) {
      result += ' ' + args.map((arg) => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg))).join(' ');
    }
    return result + '\n';
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog('debug')) {
      process.stderr.write(this.formatMessage('DEBUG', message, ...args));
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog('info')) {
      process.stderr.write(this.formatMessage('INFO', message, ...args));
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog('warn')) {
      process.stderr.write(this.formatMessage('WARN', message, ...args));
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.shouldLog('error')) {
      process.stderr.write(this.formatMessage('ERROR', message, ...args));
    }
  }
}

export const logger = new Logger();
