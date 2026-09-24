import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';
import { env } from './config/env.js';

const app = await NestFactory.create<NestExpressApplication>(AppModule);
// Tracking beacons arrive as text/plain JSON (no CORS preflight); parsed by the tracking service.
app.useBodyParser('text', { limit: '4kb' });
app.use(cookieParser());
app.enableCors({ origin: env.WEB_ORIGIN, credentials: true });
app.enableShutdownHooks();
await app.listen(env.PORT);
