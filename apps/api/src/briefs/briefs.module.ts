import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module.js';
import { BriefsController } from './briefs.controller.js';
import { BriefsService } from './briefs.service.js';

@Module({
  imports: [ProjectsModule],
  controllers: [BriefsController],
  providers: [BriefsService],
  exports: [BriefsService],
})
export class BriefsModule {}
