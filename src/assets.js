const { autoHandler } = require('knifecycle');
const path = require('path');
const { identity, mapConfigsSequentially } = require('./utils');

module.exports = autoHandler(initBuildPackageAssets);

async function initBuildPackageAssets(
  { PROJECT_DIR, fs, log, glob, require, mkdirp, resolveModule },
  packageConf,
  metapakModulesSequence,
  metapakModulesConfigs
) {
  return mapConfigsSequentially(
    metapakModulesSequence,
    metapakModulesConfigs,
    (metapakModuleName, metapakModuleConfig) => {
      const modulePath = resolveModule(metapakModuleName, packageConf);
      const packageAssetsDir = path.join(
        modulePath,
        'src',
        metapakModuleConfig,
        'assets'
      );
      const packageAssetsTransformerPath = path.join(
        modulePath,
        'src',
        metapakModuleConfig,
        'assets.js'
      );
      let transformer;

      try {
        transformer = require(packageAssetsTransformerPath);
      } catch (err) {
        log(
          'debug',
          'No asset tranformation found at:',
          packageAssetsTransformerPath
        );
        log('stack', err.stack);
        transformer = identity;
      }

      return glob('**/*', { cwd: packageAssetsDir, dot: true, nodir: true })
        .then((assets) => {
          if (assets.some((asset) => '.gitignore' === asset)) {
            log(
              'warning',
              '`.gitignore` assets may not work, use `_dot_` instead of a raw `.`'
            );
            log(
              'warning',
              'in your `assets` folder, metapak will care to rename them'
            );
            log(
              'warning',
              'correctly. See https://github.com/npm/npm/issues/15660'
            );
          }
          assets = assets.map((asset) => ({
            dir: packageAssetsDir,
            name: asset,
          }));
          return { assets, transformer };
        })
        .catch((err) => {
          log('debug', 'No assets found at:', packageAssetsDir);
          log('stack', err.stack);
          return [];
        });
    }
  )
    .then((assetsDirsGroups) => {
      assetsDirsGroups = assetsDirsGroups.reduce(
        (combined, { assets, transformer }) => ({
          assets: combined.assets.concat(assets),
          transformers: combined.transformers.concat(transformer),
        }),
        { assets: [], transformers: [] }
      );
      return assetsDirsGroups;
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
              mkdirp,
              log,
              fs,
              glob,
            },
            {
              packageConf,
              transformers,
              assetsHash,
            }
          )
        )
      );
    })
    .then((results) => {
      results = results.reduce(
        (assetsChanged, assetChanged) => assetsChanged || assetChanged,
        false
      );
      return results;
    });
}

async function _processAsset(
  { PROJECT_DIR, mkdirp, log, fs, glob },
  { packageConf, transformers, assetsHash },
  name
) {
  const { dir } = assetsHash[name];
  const assetPath = path.join(dir, name);

  log('debug', 'Processing asset:', assetPath);

  const sourceFile = {
    name: name.startsWith('_dot_') ? name.replace('_dot_', '.') : name,
    data: await fs.readFileAsync(assetPath, 'utf-8'),
  };
  const newFile = await transformers.reduce(
    (curInputFilePromise, transformer) =>
      curInputFilePromise.then((curInputFile) =>
        transformer(curInputFile, packageConf, {
          PROJECT_DIR,
          fs,
          log,
          glob,
        })
      ),
    Promise.resolve(sourceFile)
  );
  const originalFile = {
    name: sourceFile.name,
    dir,
    data: await fs
      .readFileAsync(path.join(PROJECT_DIR, newFile.name), 'utf-8')
      .catch((err) => {
        log('debug', 'Asset not found:', path.join(dir, newFile.name));
        log('stack', err.stack);
        return '';
      }),
  };

  if (newFile.data === originalFile.data) {
    return false;
  }

  if ('' === newFile.data) {
    if (originalFile.data) {
      log('debug', 'Deleting asset:', path.join(PROJECT_DIR, newFile.name));
      await fs.unlinkAsync(path.join(PROJECT_DIR, newFile.name));

      return true;
    }
    return false;
  }

  log('debug', 'Saving asset:', path.join(PROJECT_DIR, newFile.name));
  await _ensureDirExists({ PROJECT_DIR, mkdirp }, newFile);
  await fs.writeFileAsync(
    path.join(PROJECT_DIR, newFile.name),
    newFile.data,
    'utf-8'
  );

  return true;
}

function _ensureDirExists({ PROJECT_DIR, mkdirp }, newFile) {
  const dir = path.dirname(newFile.name);

  if ('.' === dir) {
    return Promise.resolve();
  }
  return mkdirp(path.join(PROJECT_DIR, dir));
}
