import * as esbuild from 'esbuild';

// Browser bundles: self-contained IIFEs, no dependencies, small enough to inline in a page.
const options = {
  entryPoints: { preview: 'src/preview.ts' },
  outdir: 'dist',
  bundle: true,
  format: 'iife',
  target: ['es2019'],
  minify: true,
  legalComments: 'none',
};

if (process.argv.includes('--watch')) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log('Watching snippet bundles…');
} else {
  await esbuild.build(options);
}
