import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module.js';
import { ExperimentsController } from './experiments.controller.js';
import { ExperimentsService } from './experiments.service.js';

@Module({
  imports: [ProjectsModule],
  controllers: [ExperimentsController],
  providers: [ExperimentsService],
  exports: [ExperimentsService],
})
export class ExperimentsModule {}
