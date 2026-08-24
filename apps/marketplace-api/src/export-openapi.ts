import 'reflect-metadata';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';
import { validateEnv } from './config/env.schema';
import { createOpenApiDocument, serializeOpenApiDocument } from './openapi';

const outputPath = path.resolve(process.cwd(), 'openapi.json');

async function exportOpenApi(): Promise<void> {
  const checkOnly = process.argv.includes('--check');
  const env = validateEnv(process.env);
  let app: INestApplication | undefined;

  try {
    // Building the Nest module graph is enough for Swagger metadata scanning.
    // The application never calls `listen`, so this command cannot claim an
    // HTTP port or interfere with a separately running API process.
    app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
    configureApp(app, env);
    const generated = serializeOpenApiDocument(createOpenApiDocument(app));

    if (checkOnly) {
      const committed = await readCommittedDocument();
      if (committed !== generated) {
        throw new Error(
          'openapi.json is out of date. Run `npm run openapi:generate` and commit the result.',
        );
      }
      return;
    }

    await writeFile(outputPath, generated, 'utf8');
  } finally {
    await app?.close();
  }
}

async function readCommittedDocument(): Promise<string> {
  try {
    return await readFile(outputPath, 'utf8');
  } catch (error) {
    if (isMissingFileError(error)) {
      throw new Error('openapi.json is missing. Run `npm run openapi:generate` and commit it.');
    }
    throw error;
  }
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

void exportOpenApi().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown OpenAPI export failure';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
