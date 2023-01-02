import path from 'path';
import { printStackTrace, YError } from 'yerror';
import { autoService } from 'knifecycle';
import type { LogService } from 'common-services';
import type { FSService } from './fs.js';
import type { ResolveModuleService } from './resolveModule.js';
import type { BuildPackageAssetsService } from './assets.js';
import type { BuildPackageGitHooksService } from './gitHooks.js';
import type {
  MetapakPackageJson,
  BuildPackageConfService,
} from './packageConf.js';

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
  resolveModule,
}: {
  ENV: Record<string, string>;
  PROJECT_DIR: string;
  log: LogService;
  exit: typeof process.exit;
  fs: FSService;
  buildPackageConf: BuildPackageConfService;
  buildPackageAssets: BuildPackageAssetsService;
  buildPackageGitHooks: BuildPackageGitHooksService;
  resolveModule: ResolveModuleService;
}): Promise<MetapakService> {
  return async function metapak() {
    try {
      const packageConf = JSON.parse(
        (
          await fs.readFileAsync(path.join(PROJECT_DIR, 'package.json'))
        ).toString(),
      ) as MetapakPackageJson;
      const metapackConfigsSequence = packageConf.metapak?.configs || [];
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

      const metapakModulesConfigs = await _getPackageMetapakModulesConfigs(
        {
          fs,
          log,
          resolveModule,
        },
        metapakModulesSequence,
        metapackConfigsSequence,
        packageConf,
      );

      let packageConfBuildResult = false;
      let iteration = 0;
      do {
        packageConfBuildResult = await buildPackageConf(
          packageConf,
          metapakModulesSequence,
          metapakModulesConfigs,
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
        buildPackageAssets(
          packageConf,
          metapakModulesSequence,
          metapakModulesConfigs,
        ),
        buildPackageGitHooks(
          packageConf,
          metapakModulesSequence,
          metapakModulesConfigs,
        ),
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
  packageConf: MetapakPackageJson,
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
  packageConf: MetapakPackageJson,
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

async function _getPackageMetapakModulesConfigs(
  {
    fs,
    log,
    resolveModule,
  }: { fs: FSService; log: LogService; resolveModule: ResolveModuleService },
  metapakModulesSequence: string[],
  metapackConfigsSequence: string[],
  packageConf: MetapakPackageJson,
) {
  const allModulesConfigs = metapakModulesSequence.reduce(
    (metapakModulesConfigs, metapakModuleName) => {
      const modulePath = path.join(
        resolveModule(metapakModuleName, packageConf),
        'src',
      );

      metapakModulesConfigs[metapakModuleName] = fs
        .readdirAsync(modulePath)
        .then((metapakModuleConfigs) => {
          metapakModuleConfigs = metapackConfigsSequence.filter(
            (metapakModuleConfig) =>
              metapakModuleConfigs.includes(metapakModuleConfig),
          );
          log(
            'debug',
            'Found configs for "' + metapakModuleName + '":',
            metapakModuleConfigs,
          );
          return metapakModuleConfigs;
        });
      return metapakModulesConfigs;
    },
    {},
  );
  return await Object.keys(allModulesConfigs).reduce(async (p, key) => {
    return {
      ...(await p),
      [key]: await allModulesConfigs[key],
    };
  }, Promise.resolve({}));
}
