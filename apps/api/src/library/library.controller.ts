import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { libraryQuerySchema } from '@uplift/shared';
import type { z } from 'zod';
import { type AuthUser, CurrentUser } from '../auth/current-user.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { LibraryService } from './library.service.js';

const uuid = new ParseUUIDPipe({ version: '4' });

@Controller('organizations/:orgId/library')
export class LibraryController {
  constructor(private readonly library: LibraryService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Param('orgId', uuid) orgId: string,
    @Query(new ZodValidationPipe(libraryQuerySchema)) query: z.output<typeof libraryQuerySchema>,
  ) {
    return this.library.list(user.id, orgId, query);
  }
}
