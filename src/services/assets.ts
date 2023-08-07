import { autoService } from 'knifecycle';
import path from 'path';
import { identityAsync, mapConfigsSequentially } from '../libs/utils.js';
import { printStackTrace } from 'yerror';
import type { MetapakContext, MetapakPackageJson } from '../libs/utils.js';
import type Glob from 'glob';
import type { FSService } from './fs.js';
import type { ImporterService, LogService } from 'common-services';

export type BuildPackageAssetsService = (
  packageConf: MetapakPackageJson<unknown, unknown>,
  metapakContext: MetapakContext,
) => Promise<void>;
export type AssetFile = {
  dir: string;
  name: string;
  data: string;
};
export type PackageAssetsTransformer<T, U> = (
  file: AssetFile,
  packageConf: MetapakPackageJson<T, U>,
  services: {
    PROJECT_DIR: string;
    log: LogService;
    fs: FSService;
  },
) => Promise<AssetFile>;

export default autoService(initBuildPackageAssets);

async function initBuildPackageAssets({
  PROJECT_DIR,
  fs,
  log,
  glob,
  importer,
}: {
  PROJECT_DIR: string;
  fs: FSService;
  log: LogService;
  glob: (pattern: string, options: Glob.IOptions) => Promise<string[]>;
  importer: ImporterService<{
    default: PackageAssetsTransformer<unknown, unknown>;
  }>;
}) {
  return async (
    packageConf: MetapakPackageJson<unknown, unknown>,
    metapakContext: MetapakContext,
  ) => {
    return mapConfigsSequentially<{
      assets: AssetFile[];
      transformer: PackageAssetsTransformer<unknown, unknown>;
    }>(metapakContext, async (metapakModuleName, metapakConfigName) => {
      const packageAssetsDir = path.join(
        metapakContext.modulesConfigs[metapakModuleName].base,
        metapakContext.modulesConfigs[metapakModuleName].assetsDir,
        metapakConfigName,
        'assets',
      );
      const packageAssetsTransformerPath = path.join(
        metapakContext.modulesConfigs[metapakModuleName].base,
        metapakContext.modulesConfigs[metapakModuleName].srcDir,
        metapakConfigName,
        'assets.js',
      );
      let transformer: PackageAssetsTransformer<unknown, unknown>;

      try {
        transformer = (await importer(packageAssetsTransformerPath)).default;
      } catch (err) {
        log(
          'debug',
          '🤷 - No asset tranformation found at:',
          packageAssetsTransformerPath,
        );
        log('debug-stack', printStackTrace(err));
        transformer = identityAsync;
      }

      try {
        const assetsNames = await glob('**/*', {
          cwd: packageAssetsDir,
          dot: true,
          nodir: true,
        });

        if (assetsNames.some((asset) => '.gitignore' === asset)) {
          log(
            'warning',
            '⚠️ - `.gitignore` assets may not work, use `_dot_` instead of a raw `.` in your `assets` folder, metapak will care to rename them correctly. See https://github.com/npm/npm/issues/15660',
          );
        }
        const assets: AssetFile[] = assetsNames.map((asset) => ({
          dir: packageAssetsDir,
          name: asset,
          data: '',
        }));
        return { assets, transformer };
      } catch (err) {
        log('debug', '🤷 - No assets found at:', packageAssetsDir);
        log('debug-stack', printStackTrace(err));
        return { assets: [], transformer };
      }
    })
      .then((assetsDirsGroups) => {
        return assetsDirsGroups.reduce(
          (combined, { assets, transformer }) => ({
            assets: combined.assets.concat(assets),
            transformers: combined.transformers.concat(transformer),
          }),
          { assets: [], transformers: [] } as {
            assets: AssetFile[];
            transformers: PackageAssetsTransformer<unknown, unknown>[];
          },
        );
      })
      .then(({ assets, transformers }) => {
        // Building the hash dedupes assets by picking them in the upper config
        const assetsHash = assets.reduce((hash, { dir, name }) => {
          hash[name] = { dir, name };
          return hash;
        }, {});

        return Promise.all(
          Object.keys(assetsHash).map(
            _processAsset.bind(
              null,
              {
                PROJECT_DIR,
                log,
                fs,
              },
              {
                packageConf,
                transformers,
                assetsHash,
              },
            ),
          ),
        );
      })
      .then((results) => {
        return results.reduce(
          (assetsChanged, assetChanged) => assetsChanged || assetChanged,
          false,
        );
      });
  };
}

async function _processAsset(
  {
    PROJECT_DIR,
    log,
    fs,
  }: {
    PROJECT_DIR: string;
    log: LogService;
    fs: FSService;
  },
  {
    packageConf,
    transformers,
    assetsHash,
  }: {
    packageConf: MetapakPackageJson<unknown, unknown>;
    transformers: PackageAssetsTransformer<unknown, unknown>[];
    assetsHash: Record<string, AssetFile>;
  },
  name: string,
) {
  const { dir } = assetsHash[name];
  const assetPath = path.join(dir, name);

  log('debug', 'Processing asset:', assetPath);

  const sourceFile: AssetFile = {
    name: name.startsWith('_dot_') ? name.replace('_dot_', '.') : name,
    dir,
    data: (await fs.readFileAsync(assetPath)).toString(),
  };
  let newFile = sourceFile;

  for (const transformer of transformers) {
    newFile = await transformer(newFile, packageConf, {
      PROJECT_DIR,
      fs,
      log,
    });
  }

  const originalFile: AssetFile = {
    name: sourceFile.name,
    dir,
    data: (
      (await fs
        .readFileAsync(path.join(PROJECT_DIR, newFile.name))
        .catch((err) => {
          log('debug', '🤷 - Asset not found:', path.join(dir, newFile.name));
          log('debug-stack', printStackTrace(err));
          return Buffer.from('');
        })) as Buffer
    ).toString(),
  };

  if (newFile.data === originalFile.data) {
    return false;
  }

  if ('' === newFile.data) {
    if (originalFile.data) {
      log('debug', '⌫ - Deleting asset:', path.join(PROJECT_DIR, newFile.name));
      await fs.unlinkAsync(path.join(PROJECT_DIR, newFile.name));

      return true;
    }
    return false;
  }

  log('debug', '💾 - Saving asset:', path.join(PROJECT_DIR, newFile.name));
  await _ensureDirExists({ PROJECT_DIR, fs }, newFile);
  await fs.writeFileAsync(
    path.join(PROJECT_DIR, newFile.name),
    Buffer.from(newFile.data || ''),
  );

  return true;
}

async function _ensureDirExists(
  { PROJECT_DIR, fs }: { PROJECT_DIR: string; fs: FSService },
  newFile: AssetFile,
) {
  const dir = path.dirname(newFile.name);

  if ('.' === dir) {
    return;
  }
  await fs.mkdirpAsync(path.join(PROJECT_DIR, dir));
}
