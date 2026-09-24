import { Global, Logger, Module } from '@nestjs/common';
import { env } from '../config/env.js';
import { AiController } from './ai.controller.js';
import { AnthropicCopyProvider } from './anthropic-copy.provider.js';
import { COPY_PROVIDER, type CopyProvider } from './copy-provider.js';
import { MockCopyProvider } from './mock-copy.provider.js';

/**
 * `AI_PROVIDER=auto` (default) uses Claude when ANTHROPIC_API_KEY is set and the mock otherwise,
 * so the app works end to end without a key (e.g. a public portfolio demo).
 */
function createCopyProvider(): CopyProvider {
  const useAnthropic =
    env.AI_PROVIDER === 'anthropic' || (env.AI_PROVIDER === 'auto' && !!env.ANTHROPIC_API_KEY);
  const provider = useAnthropic
    ? new AnthropicCopyProvider({ model: env.AI_MODEL, effort: env.AI_EFFORT })
    : new MockCopyProvider();
  new Logger('AiModule').log(
    `Copy provider: ${provider.name}${useAnthropic ? ` (${env.AI_MODEL}, effort ${env.AI_EFFORT})` : ''}`,
  );
  return provider;
}

@Global()
@Module({
  controllers: [AiController],
  providers: [{ provide: COPY_PROVIDER, useFactory: createCopyProvider }],
  exports: [COPY_PROVIDER],
})
export class AiModule {}
