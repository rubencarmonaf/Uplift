import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module.js';
import { SessionGuard } from './auth/session.guard.js';
import { DbModule } from './db/db.module.js';
import { ElementsModule } from './elements/elements.module.js';
import { HealthController } from './health.controller.js';
import { ProjectsModule } from './projects/projects.module.js';
import { SnapshotsModule } from './snapshots/snapshots.module.js';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    DbModule,
    AuthModule,
    ProjectsModule,
    ElementsModule,
    SnapshotsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Every route requires a session unless it is marked with @Public().
    { provide: APP_GUARD, useClass: SessionGuard },
  ],
})
export class AppModule {}
