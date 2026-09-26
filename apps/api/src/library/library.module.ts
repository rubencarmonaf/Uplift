import { Module } from '@nestjs/common';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { LibraryController } from './library.controller.js';
import { LibraryService } from './library.service.js';

@Module({
  imports: [OrganizationsModule],
  controllers: [LibraryController],
  providers: [LibraryService],
})
export class LibraryModule {}
