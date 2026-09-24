import { Controller, Get, Inject } from '@nestjs/common';
import { env } from '../config/env.js';
import { COPY_PROVIDER, type CopyProvider } from './copy-provider.js';

@Controller('ai')
export class AiController {
  constructor(@Inject(COPY_PROVIDER) private readonly provider: CopyProvider) {}

  /** Lets the UI say when it is showing demo (mock) variants instead of real AI output. */
  @Get('status')
  status() {
    return {
      provider: this.provider.name,
      model: this.provider.name === 'anthropic' ? env.AI_MODEL : null,
    };
  }
}
