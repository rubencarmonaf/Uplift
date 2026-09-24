import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module.js';
import { GenerationService } from './generation.service.js';
import { VariantsController } from './variants.controller.js';
import { VariantsService } from './variants.service.js';

@Module({
  imports: [ProjectsModule],
  controllers: [VariantsController],
  providers: [VariantsService, GenerationService],
})
export class VariantsModule {}
