'use strict';

const path = require('path');
const {
  identity,
  buildMetapakModulePath,
  mapConfigsSequentially,
} = require('./utils');

module.exports = initBuildPackageAssets;

function initBuildPackageAssets($) {
  $.service('buildPackageAssets', $.depends([
    'PROJECT_DIR', 'fs', 'log', 'glob', 'require',
  ], services => Promise.resolve(buildPackageAssets.bind(null, services))));
}

function buildPackageAssets(
  { PROJECT_DIR, fs, log, glob, require },
  packageConf,
  metapakModulesSequence,
  metapakModulesConfigs
) {
  return mapConfigsSequentially(
    metapakModulesSequence,
    metapakModulesConfigs,
    (metapakModuleName, metapakModuleConfig) => {
      const packageAssetsDir = buildMetapakModulePath(
        PROJECT_DIR,
        packageConf,
        metapakModuleName,
        'src',
        metapakModuleConfig,
        'assets'
      );
      const packageAssetsTransformerPath = buildMetapakModulePath(
        PROJECT_DIR,
        packageConf,
        metapakModuleName,
        'src',
        metapakModuleConfig,
        'assets.js'
      );
      let transformer;

      try {
        transformer = require(packageAssetsTransformerPath);
      } catch (err) {
        log('debug', 'No package tranformation found at:', packageAssetsTransformerPath);
        log('stack', err.stack);
        transformer = identity;
      }

      return glob('**/*', { cwd: packageAssetsDir, dot: true })
      .then((assets) => {
        assets = assets.map(asset => ({ dir: packageAssetsDir, name: asset, transformer }));
        return assets;
      })
      .catch((err) => {
        log('debug', 'No assets found at:', packageAssetsDir);
        log('stack', err.stack);
        return [];
      });
    }
  )
  .then((assetsDirsGroups) => {
    assetsDirsGroups = assetsDirsGroups
    .reduce((combined, assets) => combined.concat(assets), []);
    return assetsDirsGroups;
  })
  .then((assetsDirsFiles) => {
    // Building the hash dedupes assets by picking them in the upper config
    const assetsHash = assetsDirsFiles.reduce((hash, asset) => {
      hash[asset.name] = asset;
      return hash;
    }, {});

    return Promise.all(
      Object.keys(assetsHash)
      .map((name) => {
        const { dir, transformer } = assetsHash[name];
        const asset = path.join(dir, name);

        log('debug', 'Processing asset:', asset);
        return Promise.all([
          fs.readFileAsync(path.join(PROJECT_DIR, name), 'utf-8')
          .catch((data) => {
            log('debug', 'New asset:', asset);
            return data || '';
          }),
          fs.readFileAsync(asset, 'utf-8'),
        ])
        .then(([originalData, assetData]) => {
          const newAsset = transformer({ name, dir, transformer, data: assetData }, packageConf);

          if(newAsset.data === originalData) {
            return false;
          }

          if('' === newAsset.data) {
            return fs.unlinkAsync(path.join(PROJECT_DIR, name))
            .then(() => true);
          }

          return fs.writeFileAsync(path.join(PROJECT_DIR, name), newAsset.data, 'utf-8')
          .then(() => true);
        });
      })
    );
  })
  .then((results) => {
    results = results
    .reduce((assetsChanged, assetChanged) => assetsChanged || assetChanged, false);
    return results;
  });
}
