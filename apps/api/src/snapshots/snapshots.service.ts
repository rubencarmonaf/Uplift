import { randomBytes } from 'node:crypto';
import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import type { Snapshot } from '@uplift/shared';
import { eq } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { InjectDb } from '../db/db.module.js';
import { pageSnapshots } from '../db/schema.js';
import { ProjectAccessService } from '../projects/project-access.service.js';
import { pickerMain } from './picker-script.js';
import { RendererService, SnapshotFailedError } from './renderer.service.js';

type SnapshotRow = typeof pageSnapshots.$inferSelect;

const toSnapshotDto = (row: SnapshotRow): Snapshot => ({
  id: row.id,
  projectId: row.projectId,
  url: row.url,
  finalUrl: row.finalUrl,
  title: row.title,
  createdAt: row.createdAt.toISOString(),
});

const PICKER_SOURCE = `(${pickerMain.toString()})();`;

@Injectable()
export class SnapshotsService {
  constructor(
    @InjectDb() private readonly db: Db,
    private readonly projectAccess: ProjectAccessService,
    private readonly renderer: RendererService,
  ) {}

  async latest(userId: string, projectId: string) {
    await this.projectAccess.load(userId, projectId, 'viewer');
    const [row] = await this.db
      .select()
      .from(pageSnapshots)
      .where(eq(pageSnapshots.projectId, projectId));
    if (!row) throw new NotFoundException();
    return toSnapshotDto(row);
  }

  /** Renders the project's page again and replaces its snapshot. */
  async capture(userId: string, projectId: string) {
    const { project } = await this.projectAccess.load(userId, projectId, 'editor');
    let rendered;
    try {
      rendered = await this.renderer.render(project.url);
    } catch (err) {
      if (err instanceof SnapshotFailedError) {
        throw new UnprocessableEntityException({ message: 'Snapshot failed', reason: err.reason });
      }
      throw err;
    }
    const values = { projectId, url: project.url, ...rendered, createdAt: new Date() };
    const [row] = await this.db
      .insert(pageSnapshots)
      .values(values)
      .onConflictDoUpdate({ target: pageSnapshots.projectId, set: values })
      .returning();
    return toSnapshotDto(row!);
  }

  /** The snapshot document with the picker injected, plus the nonce its CSP must allow. */
  async document(userId: string, snapshotId: string) {
    const [row] = await this.db
      .select()
      .from(pageSnapshots)
      .where(eq(pageSnapshots.id, snapshotId));
    if (!row) throw new NotFoundException();
    await this.projectAccess.load(userId, row.projectId, 'viewer');

    const nonce = randomBytes(16).toString('base64');
    const script = `<script nonce="${nonce}">${PICKER_SOURCE}</script>`;
    const html = row.html.includes('</body>')
      ? // Function replacer: a string replacement would expand `$&`-style patterns in the script.
        row.html.replace(/<\/body>(?![\s\S]*<\/body>)/i, (end) => script + end)
      : row.html + script;
    return { html, nonce };
  }
}
