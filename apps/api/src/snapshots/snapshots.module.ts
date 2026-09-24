import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module.js';
import { RendererService } from './renderer.service.js';
import { SnapshotsController } from './snapshots.controller.js';
import { SnapshotsService } from './snapshots.service.js';

@Module({
  imports: [ProjectsModule],
  controllers: [SnapshotsController],
  providers: [SnapshotsService, RendererService],
})
export class SnapshotsModule {}
