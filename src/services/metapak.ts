import path from 'path';
import { printStackTrace, YError } from 'yerror';
import { autoService } from 'knifecycle';
import type {
  MetapakContext,
  MetapakModuleConfigs,
  MetapakPackageJson,
} from '../libs/utils.js';
import type { LogService, ResolveService } from 'common-services';
import type { FSService } from './fs.js';
import type { BuildPackageAssetsService } from './assets.js';
import type { BuildPackageGitHooksService } from './gitHooks.js';
import type { BuildPackageConfService } from './packageConf.js';

export type MetapakService = () => Promise<void>;

const MAX_PACKAGE_BUILD_ITERATIONS = 15;

export default autoService(initMetapak);

async function initMetapak({
  ENV,
  PROJECT_DIR,
  log,
  exit,
  fs,
  buildPackageConf,
  buildPackageAssets,
  buildPackageGitHooks,
  resolve,
}: {
  ENV: Record<string, string>;
  PROJECT_DIR: string;
  log: LogService;
  exit: typeof process.exit;
  fs: FSService;
  buildPackageConf: BuildPackageConfService;
  buildPackageAssets: BuildPackageAssetsService;
  buildPackageGitHooks: BuildPackageGitHooksService;
  resolve: ResolveService;
}): Promise<MetapakService> {
  return async function metapak() {
    try {
      const basePackageConf = JSON.parse(
        (
          await fs.readFileAsync(path.join(PROJECT_DIR, 'package.json'))
        ).toString(),
      );

      if (!('metapak' in basePackageConf)) {
        log(
          'error',
          `❌ - Metapak config not found in the project "package.json" file.`,
        );
        throw new YError('E_NO_METAPAK_CONFIG');
      }

      const packageConf = {
        metapak: {
          data: {},
          config: [],
          ...(basePackageConf.metapak || {}),
        },
        ...basePackageConf,
      } as MetapakPackageJson<unknown, unknown>;

      const metapakModulesSequence = _getMetapakModulesSequence(
        { log },
        packageConf,
      );

      if (!metapakModulesSequence.length) {
        log('debug', 'No metapak modules found.');
      } else {
        log(
          'debug',
          'Resolved the metapak modules sequence:',
          metapakModulesSequence,
        );
      }

      const metapakModulesConfigs = await readMetapakModulesConfigs(
        {
          PROJECT_DIR,
          fs,
          log,
          resolve,
        },
        metapakModulesSequence,
        packageConf,
      );

      const metapakConfigsSequence = (
        packageConf.metapak?.configs || []
      ).filter((configName) => {
        const configFound = Object.keys(metapakModulesConfigs).some(
          (aModuleName) =>
            metapakModulesConfigs[aModuleName].configs.includes(configName),
        );

        if (!configFound) {
          log(
            'error',
            `❌ - Metapak configs sequence refers to an unavailable config (${configName}).`,
          );
        }

        return configFound;
      });

      const metapakContext: MetapakContext = {
        modulesConfigs: metapakModulesConfigs,
        modulesSequence: metapakModulesSequence,
        configsSequence: metapakConfigsSequence,
      };
      let packageConfBuildResult = false;
      let iteration = 0;

      do {
        packageConfBuildResult = await buildPackageConf(
          packageConf,
          metapakContext,
        );
        iteration++;
      } while (
        packageConfBuildResult &&
        iteration < MAX_PACKAGE_BUILD_ITERATIONS
      );

      if (packageConfBuildResult) {
        log(
          'error',
          `🤷 - Reached the maximum allowed iterations. It means metapak keeps changing the repository and never reach a stable state. Probably that some operations made are not idempotent.`,
        );
        throw new YError(
          'E_MAX_ITERATIONS',
          iteration,
          MAX_PACKAGE_BUILD_ITERATIONS,
        );
      }

      const promises = [
        Promise.resolve(packageConfBuildResult),
        buildPackageAssets(packageConf, metapakContext),
        buildPackageGitHooks(packageConf, metapakContext),
      ];

      // Avoid stopping the process immediately for one failure
      await Promise.allSettled(promises);
      const [packageConfModified, assetsModified] = await Promise.all(promises);

      // The CI should not modify the repo contents and should fail when the
      // package would have been modified cause it should not happen and it probably
      // is a metapak misuse.
      if ((packageConfModified || assetsModified) && ENV.CI) {
        log(
          'error',
          '💀 - This commit is not valid since it do not match the meta package state.',
        );
        exit(1);
      }
      if (packageConfModified) {
        log(
          'info',
          '🚧 - The project package.json changed, you may want' +
            ' to `npm install` again to install new dependencies.',
        );
      }
      if (assetsModified) {
        log(
          'info',
          '🚧 - Some assets were added to the project, you may want to stage them.',
        );
      }
      exit(0);
    } catch (err) {
      const castedErr = YError.cast(err as Error);

      log(
        'error',
        '💀 - Could not run metapak script correctly:',
        castedErr.code,
        castedErr.params,
      );
      log('warning', '💊 - Debug by running again with "DEBUG=metapak" env.');
      log('error-stack', printStackTrace(castedErr));
      exit(1);
    }
  };
}

function _getMetapakModulesSequence(
  { log }: { log: LogService },
  packageConf: MetapakPackageJson<unknown, unknown>,
) {
  const reg = new RegExp(/^(@.+\/)?metapak-/);
  const metapakModulesNames = Object.keys(
    packageConf.devDependencies || {},
  ).filter((devDependency) => reg.test(devDependency));

  // Allowing a metapak module to run on himself
  if (packageConf.name && reg.test(packageConf.name)) {
    metapakModulesNames.unshift(packageConf.name);
  }

  return _reorderMetapakModulesNames({ log }, packageConf, metapakModulesNames);
}

function _reorderMetapakModulesNames(
  { log }: { log: LogService },
  packageConf: MetapakPackageJson<unknown, unknown>,
  metapakModulesNames: string[],
) {
  if (packageConf.metapak && packageConf.metapak.sequence) {
    if (!(packageConf.metapak.sequence instanceof Array)) {
      throw new YError(
        'E_BAD_SEQUENCE_TYPE',
        typeof packageConf.metapak.sequence,
        packageConf.metapak.sequence,
      );
    }
    packageConf.metapak.sequence.forEach((moduleName) => {
      if (!metapakModulesNames.includes(moduleName)) {
        throw new YError('E_BAD_SEQUENCE_ITEM', moduleName);
      }
    });
    log(
      'debug',
      'Reordering metapak modules sequence.',
      packageConf.metapak.sequence,
    );
    return packageConf.metapak.sequence;
  }
  return metapakModulesNames;
}

async function readMetapakModulesConfigs(
  {
    PROJECT_DIR,
    fs,
    log,
    resolve,
  }: {
    PROJECT_DIR: string;
    fs: FSService;
    log: LogService;
    resolve: ResolveService;
  },
  metapakModulesSequence: string[],
  packageConf: MetapakPackageJson<unknown, unknown>,
): Promise<MetapakModuleConfigs> {
  const moduleConfigs: MetapakModuleConfigs = {};

  for (const metapakModuleName of metapakModulesSequence) {
    let base = '';

    try {
      // Cover the case a metapak plugin runs itself
      if (metapakModuleName === packageConf.name) {
        base = path.dirname(resolve(`${PROJECT_DIR}/package`));
      } else {
        base = path.dirname(resolve(`${metapakModuleName}/package`));
      }
    } catch (err) {
      throw YError.wrap(
        err as Error,
        'E_MODULE_NOT_FOUND',
        metapakModuleName,
        packageConf.name,
      );
    }
    const assetsDir = 'src';
    const eventualBuildDir = path.join(base, 'dist');
    let buildExists = false;

    try {
      await fs.accessAsync(eventualBuildDir);
      buildExists = true;
    } catch (err) {
      log('debug', `🏗 - No build path found (${eventualBuildDir}).`);
      log('debug-stack', printStackTrace(err));
    }

    const srcDir = buildExists ? 'dist' : 'src';
    const fullSrcDir = path.join(base, srcDir);
    let configs: string[] = [];

    try {
      configs = await fs.readdirAsync(fullSrcDir);
    } catch (err) {
      log(
        'error',
        `❌ - No configs found at "${fullSrcDir}" for the module "${metapakModuleName}".`,
      );
      log('error-stack', printStackTrace(err));
      throw err;
    }

    moduleConfigs[metapakModuleName] = {
      base,
      assetsDir,
      srcDir,
      configs,
    };
    log(
      'debug',
      `📥 - Built config for "${metapakModuleName}:`,
      moduleConfigs[metapakModuleName],
    );
  }

  return moduleConfigs;
}
