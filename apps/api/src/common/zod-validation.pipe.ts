import { BadRequestException, type PipeTransform } from '@nestjs/common';
import { z, type ZodType } from 'zod';

/** Validates and parses a request value: `@Body(new ZodValidationPipe(schema)) body: Input`. */
export class ZodValidationPipe<T extends ZodType> implements PipeTransform {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.output<T> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: z.flattenError(result.error).fieldErrors,
      });
    }
    return result.data;
  }
}
