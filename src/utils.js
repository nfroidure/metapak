'use strict';

const path = require('path');

module.exports = {
  identity: x => x,
  buildMetapakModulePath,
  mapConfigsSequentially
};

function buildMetapakModulePath(PROJECT_DIR, packageConf, metapakModuleName, ...parts) {
  // Take in count the edge case of self applying metapak module
  parts = [PROJECT_DIR].concat(
    packageConf.name !== metapakModuleName ?
    ['node_modules', metapakModuleName] :
    []
  ).concat(parts);
  return path.join(...parts);
}

function mapConfigsSequentially(metapakModulesSequence, metapakModulesConfigs, fn) {
  return Promise.resolve()
  .then(() => {
    return Promise.all(
      metapakModulesSequence.map((metapakModuleName) => {
        return Promise.all(
          metapakModulesConfigs[metapakModuleName]
          .map((metapakModuleConfig) => {
            return fn (
              metapakModuleName,
              metapakModuleConfig
            );
          })
        );
      })
    )
    .then((packageTransformers) => {
      return packageTransformers.reduce((combined, packageTransformer) => {
        return combined.concat(packageTransformer);
      }, []);
    });
  });
}
