import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module.js';
import { GoalsController } from './goals.controller.js';
import { GoalsService } from './goals.service.js';

@Module({
  imports: [ProjectsModule],
  controllers: [GoalsController],
  providers: [GoalsService],
})
export class GoalsModule {}
