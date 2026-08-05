import type { LoggerService } from '@nestjs/common';

type LogLevel = 'debug' | 'log' | 'warn' | 'error';

const levelPriority: Record<LogLevel, number> = {
  debug: 10,
  log: 20,
  warn: 30,
  error: 40,
};

export class JsonLoggerService implements LoggerService {
  constructor(private readonly minimumLevel: LogLevel = 'log') {}

  log(message: unknown, context?: string): void {
    this.write('log', message, context);
  }

  error(message: unknown, trace?: string, context?: string): void {
    this.write('error', message, context, trace);
  }

  warn(message: unknown, context?: string): void {
    this.write('warn', message, context);
  }

  debug(message: unknown, context?: string): void {
    this.write('debug', message, context);
  }

  private write(level: LogLevel, message: unknown, context?: string, trace?: string): void {
    if (levelPriority[level] < levelPriority[this.minimumLevel]) {
      return;
    }

    const payload = {
      timestamp: new Date().toISOString(),
      level,
      context,
      message: typeof message === 'string' ? message : JSON.stringify(message),
      trace,
    };

    const line = JSON.stringify(payload);
    if (level === 'error') {
      console.error(line);
      return;
    }
    if (level === 'warn') {
      console.warn(line);
      return;
    }
    console.log(line);
  }
}
