import { Knifecycle, constant, autoService, name } from 'knifecycle';
import {
  initLogService,
  initImporterService,
  initResolveService,
} from 'common-services';
import initDebug from 'debug';
import os from 'os';
import path from 'path';
import glob from 'glob';
import { promisify } from 'util';
import { exec } from 'child_process';
import initFS from './services/fs.js';
import initMetapak from './services/metapak.js';
import initBuildPackageConf from './services/packageConf.js';
import initBuildPackageAssets from './services/assets.js';
import initBuildPackageGitHooks from './services/gitHooks.js';
import initProjectDir from './services/projectDir.js';
import initResolveModule from './services/resolveModule.js';
import initProgramOptions from './services/programOptions.js';
import type { MetapakService } from './services/metapak.js';
import type { PackageJSONTransformer } from './libs/utils.js';
import type { PackageAssetsTransformer } from './services/assets.js';
import type { GitHooksTransformer } from './services/gitHooks.js';

export type {
  PackageAssetsTransformer,
  PackageJSONTransformer,
  GitHooksTransformer,
};

export async function runMetapak() {
  try {
    const $ = await prepareMetapak();

    const { metapak } = await $.run<{
      metapak: MetapakService;
    }>(['metapak']);

    await metapak();
  } catch (err) {
    // eslint-disable-next-line
    console.error(err);
    process.exit(1);
  }
}

export async function prepareMetapak($ = new Knifecycle()) {
  $.register(initMetapak);
  $.register(constant('ENV', process.env));
  $.register(constant('exit', process.exit));
  $.register(constant('EOL', os.EOL));
  $.register(constant('glob', promisify(glob)));
  $.register(
    constant('logger', {
      // eslint-disable-next-line
      output: console.info.bind(console),
      // eslint-disable-next-line
      error: console.error.bind(console),
      // eslint-disable-next-line
      debug: initDebug('metapak'),
    }),
  );
  $.register(initLogService);
  $.register(initImporterService);
  $.register(initResolveService);
  $.register(initResolveModule);
  $.register(name('PROJECT_DIR', initProjectDir));
  $.register(name('GIT_HOOKS_DIR', autoService(initGitHooksDir)));

  $.register(initBuildPackageConf);
  $.register(initBuildPackageAssets);
  $.register(initBuildPackageGitHooks);
  $.register(initProgramOptions);
  $.register(initFS);

  return $;
}

async function initGitHooksDir({ PROJECT_DIR, fs, log }) {
  return new Promise((resolve) => {
    exec(
      'git rev-parse --git-dir',
      {
        cwd: PROJECT_DIR,
      },
      (err, stdout, stderr) => {
        const outputPath = path.join(stdout.toString().trim(), 'hooks');
        const GIT_HOOKS_DIR = path.isAbsolute(outputPath)
          ? outputPath
          : path.join(PROJECT_DIR, outputPath);

        if (err || !stdout) {
          log('debug', 'Could not find hooks dir.', err ? err.stack : '');
          log('debug', 'stdout:', stdout);
          log('debug', 'stderr:', stderr);
          resolve('');
          return;
        }
        log('debug', 'Found hooks dir:', GIT_HOOKS_DIR);

        // Check the dir exists in order to avoid bugs in non-git
        // envs (docker images for instance)
        fs.accessAsync(GIT_HOOKS_DIR, fs.constants.W_OK)
          .then(() => {
            log('debug', 'Hooks dir exists:', GIT_HOOKS_DIR);
            resolve(GIT_HOOKS_DIR);
          })
          .catch((err2) => {
            log('debug', 'Hooks dir does not exist:', GIT_HOOKS_DIR);
            log('stack', err2.stack);
            resolve('');
          });
      },
    );
  });
}
