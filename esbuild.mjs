import * as esbuild from 'esbuild';

const watch = process.argv.includes('--watch');

const shared = {
  bundle: true,
  sourcemap: true,
  logLevel: 'info',
  minify: false,
};

const extensionBuild = {
  ...shared,
  entryPoints: ['src/extension.ts'],
  outfile: 'dist/extension.js',
  platform: 'node',
  format: 'cjs',
  target: 'node18',
  external: ['vscode'],
};

const webviewBuild = {
  ...shared,
  entryPoints: ['src/webview/main.ts'],
  outfile: 'media/webview.js',
  platform: 'browser',
  format: 'iife',
  target: 'es2022',
};

if (watch) {
  const [extensionContext, webviewContext] = await Promise.all([
    esbuild.context(extensionBuild),
    esbuild.context(webviewBuild),
  ]);
  await Promise.all([extensionContext.watch(), webviewContext.watch()]);
  console.log('Watching extension and webview bundles...');
} else {
  await Promise.all([esbuild.build(extensionBuild), esbuild.build(webviewBuild)]);
}
