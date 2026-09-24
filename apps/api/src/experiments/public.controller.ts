import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { Body, Controller, Get, Headers, HttpCode, Param, Post, Query, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { eq } from 'drizzle-orm';
import type { Response } from 'express';
import { Public } from '../auth/public.decorator.js';
import { env, isProd } from '../config/env.js';
import type { Db } from '../db/client.js';
import { InjectDb } from '../db/db.module.js';
import { experiments, goals, pageSnapshots } from '../db/schema.js';
import { ExperimentsService } from './experiments.service.js';
import { TrackingService } from './tracking.service.js';

const resolveBundle = createRequire(import.meta.url).resolve;
const bundles = new Map<string, string>();
/** Snippet bundles; re-read in development so rebuilding them needs no API restart. */
function bundle(name: 'uplift' | 'testbar') {
  let code = bundles.get(name);
  if (!code || !isProd) {
    code = readFileSync(resolveBundle(`@uplift/snippet/${name}`), 'utf8');
    bundles.set(name, code);
  }
  return code;
}

/** JSON that is safe to embed in a <script> or in JS source. */
const LINE_SEPARATORS = new RegExp('[\u2028\u2029]', 'g');
const scriptJson = (value: unknown) =>
  JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(LINE_SEPARATORS, (c) => (c === '\u2028' ? '\\u2028' : '\\u2029'));

const escapeAttr = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

const TESTBAR_LABELS = {
  es: {
    title: 'Página de prueba · Uplift',
    assigned: 'Versión:',
    outside: 'fuera del experimento',
    original: 'Control',
    forced: 'forzada',
    notRunning: 'el experimento no está en marcha',
    visitor: 'Visitante',
    events: 'Eventos enviados',
    noEvents: 'Ninguno todavía',
    exposure: 'Exposición',
    conversion: 'Conversión',
    newVisitor: 'Visitante nuevo',
    force: 'Ver',
    clickKept: 'Clic registrado · navegación desactivada en la prueba',
    forcedHint: 'Con una versión forzada no se envía ningún evento.',
  },
  en: {
    title: 'Test page · Uplift',
    assigned: 'Version:',
    outside: 'outside the experiment',
    original: 'Control',
    forced: 'forced',
    notRunning: 'the experiment is not running',
    visitor: 'Visitor',
    events: 'Events sent',
    noEvents: 'None yet',
    exposure: 'Exposure',
    conversion: 'Conversion',
    newVisitor: 'New visitor',
    force: 'Show',
    clickKept: 'Click recorded · navigation disabled on the test page',
    forcedHint: 'No events are sent while a version is forced.',
  },
};

/**
 * Endpoints customer sites talk to. Public (no session), open to any origin, and keyed by the
 * experiment's public key.
 */
@Public()
@Controller('s/:key')
export class PublicSnippetController {
  constructor(
    @InjectDb() private readonly db: Db,
    private readonly experiments: ExperimentsService,
    private readonly tracking: TrackingService,
  ) {}

  @Get('uplift.js')
  async script(
    @Param('key') key: string,
    @Query('test') test: string | undefined,
    @Res() res: Response,
  ) {
    const config = await this.experiments.runtimeConfig(key);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.type('application/javascript');
    if (!config) {
      res.status(404).send('/* Uplift: unknown experiment */');
      return;
    }
    if (test) {
      const [snapshot] = await this.db
        .select({ finalUrl: pageSnapshots.finalUrl })
        .from(pageSnapshots)
        .innerJoin(experiments, eq(experiments.projectId, pageSnapshots.projectId))
        .where(eq(experiments.publicKey, key));
      if (snapshot) config.pageUrl = snapshot.finalUrl;
    }
    // Short cache: status changes (pause, winner) reach visitors within a minute.
    res.setHeader('Cache-Control', test ? 'no-store' : 'public, max-age=60');
    res.send(`${bundle('uplift')}\n;window.__upliftBoot(${scriptJson(config)});`);
  }

  @Post('events')
  @HttpCode(204)
  @Throttle({ default: { ttl: 60_000, limit: 120 } })
  async events(
    @Param('key') key: string,
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    await this.tracking.ingest(key, body);
  }

  /** A copy of the page with the real script installed, to try the experiment end to end. */
  @Get('test')
  async testPage(
    @Param('key') key: string,
    @Headers('accept-language') acceptLanguage: string | undefined,
    @Res() res: Response,
  ) {
    const [row] = await this.db
      .select({ experiment: experiments, html: pageSnapshots.html })
      .from(experiments)
      .leftJoin(pageSnapshots, eq(pageSnapshots.projectId, experiments.projectId))
      .where(eq(experiments.publicKey, key));
    const lang = acceptLanguage?.toLowerCase().startsWith('es') ? 'es' : 'en';
    if (!row?.html) {
      res
        .status(404)
        .type('text/plain')
        .send(
          lang === 'es'
            ? 'Carga primero la página del proyecto (en Elementos o Vista previa).'
            : 'Load the project page first (in Elements or Preview).',
        );
      return;
    }
    const { experiment } = row;
    const goalRows = await this.db
      .select({ id: goals.id, name: goals.name })
      .from(goals)
      .where(eq(goals.projectId, experiment.projectId));

    const nonce = randomBytes(16).toString('base64');
    const antiFlicker = experiment.antiFlickerEnabled
      ? `<style>.uplift-hide{opacity:0!important}</style><script nonce="${nonce}">document.documentElement.classList.add('uplift-hide');setTimeout(function(){document.documentElement.classList.remove('uplift-hide')},${experiment.antiFlickerTimeoutMs})</script>`
      : '';
    const testbarAttrs = [
      `data-arms="${escapeAttr(JSON.stringify(experiment.arms.map((a) => ({ id: a.id, name: a.name }))))}"`,
      `data-goals="${escapeAttr(JSON.stringify(Object.fromEntries(goalRows.map((g) => [g.id, g.name]))))}"`,
      `data-labels="${escapeAttr(JSON.stringify(TESTBAR_LABELS[lang]))}"`,
    ].join(' ');
    const head = [
      antiFlicker,
      `<script nonce="${nonce}" ${testbarAttrs}>${bundle('testbar').replace(/<\/script/gi, '<\\/script')}</script>`,
      `<script nonce="${nonce}" src="${env.PUBLIC_API_URL}/s/${encodeURIComponent(key)}/uplift.js?test=1"></script>`,
    ].join('');
    const html = /<head[^>]*>/i.test(row.html)
      ? row.html.replace(/<head[^>]*>/i, (open) => open + head)
      : head + row.html;

    // Third-party HTML: sandboxed (opaque origin), only our nonce'd scripts, beacons to the API only.
    res.setHeader(
      'Content-Security-Policy',
      [
        'sandbox allow-scripts',
        "default-src 'none'",
        `script-src 'nonce-${nonce}'`,
        "style-src * data: 'unsafe-inline'",
        'img-src * data: blob:',
        'font-src * data:',
        `connect-src ${new URL(env.PUBLIC_API_URL).origin}`,
        "form-action 'none'",
        'base-uri *',
        "frame-ancestors 'none'",
      ].join('; '),
    );
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.type('html').send(html);
  }
}
