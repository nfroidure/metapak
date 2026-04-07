import { Knifecycle, constant, autoService, name } from 'knifecycle';
import {
  initLog,
  initImporter,
  initResolve,
  type LogService,
} from 'common-services';
import initDebug from 'debug';
import os from 'node:os';
import { join, isAbsolute } from 'node:path';
import { env, exit } from 'node:process';
import { glob } from 'glob';
import { exec } from 'node:child_process';
import initFS from './services/fs.js';
import initMetapak, { type MetapakService } from './services/metapak.js';
import initBuildPackageConf from './services/packageConf.js';
import initBuildPackageAssets from './services/assets.js';
import initBuildPackageGitHooks from './services/gitHooks.js';
import { initProjectDir } from 'application-services';
import initProgramOptions from './services/programOptions.js';
import {
  type MetapakPackageJson,
  type PackageJSONTransformer,
} from './libs/utils.js';
import { type PackageAssetsTransformer } from './services/assets.js';
import { type GitHooksTransformer } from './services/gitHooks.js';
import { type FSService } from './services/fs.js';
import { printStackTrace } from 'yerror';

export type {
  MetapakPackageJson,
  PackageAssetsTransformer,
  PackageJSONTransformer,
  GitHooksTransformer,
  FSService,
  LogService,
};

export async function runMetapak() {
  try {
    const $ = await prepareMetapak();

    const { metapak } = await $.run<{
      metapak: MetapakService;
    }>(['metapak']);

    await metapak();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

export async function prepareMetapak($ = new Knifecycle()) {
  $.register(initMetapak);
  $.register(constant('ENV', env));
  $.register(constant('MAIN_FILE_URL', import.meta.url));
  $.register(constant('exit', exit));
  $.register(constant('EOL', os.EOL));
  $.register(constant('glob', glob));
  $.register(
    constant('logger', {
      output: console.info.bind(console),
      error: console.error.bind(console),
      debug: initDebug('metapak'),
    }),
  );
  $.register(initLog);
  $.register(initImporter);
  $.register(initResolve);
  $.register(name('PROJECT_DIR', initProjectDir));
  $.register(name('GIT_HOOKS_DIR', autoService(initGitHooksDir)));

  $.register(initBuildPackageConf);
  $.register(initBuildPackageAssets);
  $.register(initBuildPackageGitHooks);
  $.register(initProgramOptions);
  $.register(initFS);

  return $;
}

async function initGitHooksDir({
  PROJECT_DIR,
  fs,
  log,
}: {
  PROJECT_DIR: string;
  fs: FSService;
  log: LogService;
}) {
  return new Promise((resolve) => {
    exec(
      'git rev-parse --git-dir',
      {
        cwd: PROJECT_DIR,
      },
      (err, stdout, stderr) => {
        const outputPath = join(stdout.toString().trim(), 'hooks');
        const GIT_HOOKS_DIR = isAbsolute(outputPath)
          ? outputPath
          : join(PROJECT_DIR, outputPath);

        if (err || !stdout) {
          log('debug', '🤷 - Could not find hooks dir.');
          log('debug-stack', printStackTrace(err as Error));
          log('debug', 'stdout:', stdout);
          log('debug', 'stderr:', stderr);
          resolve('');
          return;
        }
        log('debug', '✅ - Found hooks dir:', GIT_HOOKS_DIR);

        // Check the dir exists in order to avoid bugs in non-git
        // envs (docker images for instance)
        fs.accessAsync(GIT_HOOKS_DIR, fs.constants.W_OK)
          .then(() => {
            log('debug', '✅ - Hooks dir exists:', GIT_HOOKS_DIR);
            resolve(GIT_HOOKS_DIR);
          })
          .catch((err2) => {
            log('debug', '🤷 - Hooks dir does not exist:', GIT_HOOKS_DIR);
            log('debug-stack', printStackTrace(err2 as Error));
            resolve('');
          });
      },
    );
  });
}
