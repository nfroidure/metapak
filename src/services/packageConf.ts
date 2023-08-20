import { autoService } from 'knifecycle';
import sortKeys from 'sort-keys';
import { isDeepStrictEqual } from 'util';
import path from 'path';
import { mapConfigsSequentially, identity, buildDiff } from '../libs/utils.js';
import { YError, printStackTrace } from 'yerror';
import type { MetapakContext } from '../libs/utils.js';
import type { ImporterService, LogService } from 'common-services';
import type {
  PackageJSONTransformer,
  MetapakPackageJson,
} from '../libs/utils.js';
import type { FSService } from './fs.js';

export type BuildPackageConfService = (
  packageConf: MetapakPackageJson<unknown, unknown>,
  metapakContext: MetapakContext,
) => Promise<boolean>;

const METAPAK_SCRIPT = 'metapak';

export default autoService(initBuildPackageConf);

async function initBuildPackageConf({
  PROJECT_DIR,
  fs,
  importer,
  log,
}: {
  PROJECT_DIR: string;
  fs: Pick<FSService, 'writeFileAsync'>;
  importer: ImporterService<{
    default: PackageJSONTransformer<unknown, unknown>;
  }>;
  log: LogService;
}): Promise<BuildPackageConfService> {
  return async (
    packageConf: MetapakPackageJson<unknown, unknown>,
    metapakContext: MetapakContext,
  ) => {
    const originalDependencies = Object.keys(packageConf.dependencies || {});
    const originalPackageConf = JSON.stringify(packageConf, null, 2);

    const packageTransformers = await mapConfigsSequentially(
      metapakContext,
      async (
        metapakModuleName: string,
        metapakConfigName: string,
      ): Promise<PackageJSONTransformer<unknown, unknown>> => {
        const packageTransformPath = path.join(
          metapakContext.modulesConfigs[metapakModuleName].base,
          metapakContext.modulesConfigs[metapakModuleName].srcDir,
          metapakConfigName,
          'package.js',
        );

        try {
          const transformer = (await importer(packageTransformPath)).default;

          log(
            'debug',
            `✅ - Package tranformation found at: ${packageTransformPath}`,
          );

          return transformer;
        } catch (err) {
          log(
            'debug',
            `🤷 - No package tranformation found at: ${packageTransformPath}`,
          );
          log('debug-stack', printStackTrace(err as YError));
        }
        return identity;
      },
    );

    let newPackageConf: MetapakPackageJson<unknown, unknown> = packageConf;

    // Adding the `metapak` postinstall script via an idempotent way
    newPackageConf.scripts = packageConf.scripts || {};
    if ('metapak' !== packageConf.name) {
      newPackageConf.scripts.metapak = METAPAK_SCRIPT;
    }
    newPackageConf = packageTransformers.reduce(
      (newPackageConf, packageTransformer) =>
        packageTransformer(newPackageConf),
      packageConf,
    );
    if (
      Object.keys(newPackageConf.dependencies || {})
        .sort()
        .join() !== originalDependencies.sort().join()
    ) {
      log(
        'warning',
        '⚠️ - Changing dependencies with metapak is not recommended!',
      );
    }
    if (newPackageConf.dependencies) {
      newPackageConf.dependencies = sortKeys(newPackageConf.dependencies);
    }
    if (newPackageConf.devDependencies) {
      newPackageConf.devDependencies = sortKeys(newPackageConf.devDependencies);
    }
    if (newPackageConf.scripts) {
      newPackageConf.scripts = sortKeys(newPackageConf.scripts);
    }

    const data = JSON.stringify(newPackageConf, null, 2);

    if (
      originalPackageConf === data ||
      isDeepStrictEqual(JSON.parse(originalPackageConf), JSON.parse(data))
    ) {
      return false;
    }

    log('debug-stack', buildDiff(originalPackageConf, data));

    log(
      'debug',
      '💾 - Saving the package:',
      path.join(PROJECT_DIR, 'package.json'),
    );

    await fs.writeFileAsync(
      path.join(PROJECT_DIR, 'package.json'),
      Buffer.from(data, 'utf-8'),
    );

    return true;
  };
}
