import { Module } from '@nestjs/common';
import { OrgAccessService } from './org-access.service.js';
import { OrganizationsController } from './organizations.controller.js';

@Module({
  controllers: [OrganizationsController],
  providers: [OrgAccessService],
  exports: [OrgAccessService],
})
export class OrganizationsModule {}
