import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module.js';
import { ExperimentsController } from './experiments.controller.js';
import { ExperimentsService } from './experiments.service.js';
import { PublicSnippetController } from './public.controller.js';
import { TrackingService } from './tracking.service.js';

@Module({
  imports: [ProjectsModule],
  controllers: [ExperimentsController, PublicSnippetController],
  providers: [ExperimentsService, TrackingService],
  exports: [ExperimentsService],
})
export class ExperimentsModule {}
