import { Body, Controller, Delete, Get, Inject, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard, CurrentUser, type AuthUser } from '@platform/authz';
import { z } from 'zod';
import { ObjectStorage, objectKeyFor } from '@platform/storage';
import { ConflictError, NotFoundError } from '@platform/common';
import { and, eq } from 'drizzle-orm';
import { DB, type Database } from '../../core.module';
import { STORAGE } from '../../infrastructure.module';
import { imageObjects } from '../../schema/drawer';

const presignSchema = z.object({
  fileName: z.string().min(1).max(255),
  contentType: z.string().min(1).max(128).optional(),
});

@Controller('uploads')
@UseGuards(AuthGuard)
export class UploadsController {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(STORAGE) private readonly storage: ObjectStorage,
  ) {}

  @Post('presign')
  async presign(@CurrentUser() user: AuthUser, @Body() body: unknown): Promise<unknown> {
    const input = presignSchema.parse(body);
    const objectKey = objectKeyFor(user.id, input.fileName);
    const presigned = await this.storage.presignUpload(objectKey, input.contentType);

    await this.db
      .insert(imageObjects)
      .values({
        ownerId: user.id,
        bucket: this.storage.bucket,
        objectKey,
        contentType: input.contentType ?? null,
      })
      .onConflictDoNothing();

    return presigned;
  }

  @Get('object')
  async signedUrl(@CurrentUser() user: AuthUser, @Query('key') objectKey: string): Promise<unknown> {
    const rows = await this.db
      .select({ ownerId: imageObjects.ownerId })
      .from(imageObjects)
      .where(and(eq(imageObjects.bucket, this.storage.bucket), eq(imageObjects.objectKey, objectKey)))
      .limit(1);
    if (!rows[0]) throw new NotFoundError('Object not found');

    const url = await this.storage.presignDownload(objectKey);
    return { url, publicUrl: this.storage.publicUrl(objectKey) };
  }

  @Delete('object')
  async remove(@CurrentUser() user: AuthUser, @Query('key') objectKey: string): Promise<unknown> {
    const rows = await this.db
      .select({ ownerId: imageObjects.ownerId })
      .from(imageObjects)
      .where(and(eq(imageObjects.bucket, this.storage.bucket), eq(imageObjects.objectKey, objectKey)))
      .limit(1);
    if (!rows[0]) throw new NotFoundError('Object not found');
    if (rows[0].ownerId !== user.id) throw new ConflictError('Not your object');

    await this.storage.removeObject(objectKey);
    await this.db.delete(imageObjects).where(eq(imageObjects.objectKey, objectKey));
    return { ok: true };
  }
}
