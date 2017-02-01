'use strict';

const path = require('path');
const {
  buildMetapakModulePath,
  mapConfigsSequentially,
  identity
} = require('./utils');

module.exports = initBuildPackageConf;

function initBuildPackageConf($) {
  $.service('buildPackageConf', $.depends([
    'PROJECT_DIR', 'fs', 'require', 'log'
  ], (services) => {
    return Promise.resolve(buildPackageConf.bind(null, services));
  }));
}

function buildPackageConf(
  { PROJECT_DIR, fs, require, log },
  packageConf,
  metapakModulesSequence,
  metapakModulesConfigs
) {
  const originalPackageConf = JSON.stringify(packageConf, null, 2);
  return mapConfigsSequentially(
    metapakModulesSequence,
    metapakModulesConfigs,
    (metapakModuleName, metapakModuleConfig) => {
      const packageTransformPath = buildMetapakModulePath(
        PROJECT_DIR,
        packageConf,
        metapakModuleName,
        'src',
        metapakModuleConfig,
        'package.js'
      );
      try {
        return require(packageTransformPath);
      } catch (err) {
        log('debug', 'No package tranformation found at:', packageTransformPath);
        log('stack', err.stack);
      }
      return identity;
    }
  )
  .then((packageTransformers) => {
    return packageTransformers.reduce((newPackageConf, packageTransformer) => {
      return packageTransformer(newPackageConf);
    }, packageConf);
  })
  .then((newPackageConf) => {
    const data = JSON.stringify(newPackageConf, null, 2);

    if(originalPackageConf === data) {
      return false;
    }

    return fs.writeFileAsync(
      path.join(PROJECT_DIR, 'package.json'),
      data,
      'utf-8'
    ).then(() => true);
  });
}
