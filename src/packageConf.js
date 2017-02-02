'use strict';

const path = require('path');
const sortobject = require('deep-sort-object');
const {
  buildMetapakModulePath,
  mapConfigsSequentially,
  identity,
} = require('./utils');

module.exports = initBuildPackageConf;

function initBuildPackageConf($) {
  $.service('buildPackageConf', $.depends([
    'PROJECT_DIR', 'fs', 'require', 'log',
  ], services => Promise.resolve(buildPackageConf.bind(null, services))));
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
        const transformer = require(packageTransformPath);

        log('debug', 'Package tranformation found at:', packageTransformPath);
        return transformer;
      } catch (err) {
        log('debug', 'No package tranformation found at:', packageTransformPath);
        log('stack', err.stack);
      }
      return identity;
    }
  )
  .then((packageTransformers) => {
    const newPackageConf = packageTransformers
    .reduce(
      (newPackageConf, packageTransformer) =>
        packageTransformer(newPackageConf),
      packageConf
    );
    // Adding the `metapak` postinstall script via an idempotent way
    packageConf.scripts = packageConf.scripts || {};
    if(
      (!packageConf.scripts.postinstall) ||
      -1 === packageConf.scripts.postinstall.indexOf('metapak')
    ) {
      packageConf.scripts.postinstall = packageConf.scripts.postinstall ?
        packageConf.scripts.postinstall + '; metapak' :
        'metapak';
    }
    return sortobject(newPackageConf);
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
