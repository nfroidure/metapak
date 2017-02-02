'use strict';

const path = require('path');

module.exports = {
  identity: x => x,
  buildMetapakModulePath,
  mapConfigsSequentially,
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
  .then(() =>
    Promise.all(
      metapakModulesSequence.map(metapakModuleName =>
        Promise.all(
          metapakModulesConfigs[metapakModuleName]
          .map(metapakModuleConfig =>
            fn(
              metapakModuleName,
              metapakModuleConfig
            )
          )
        )
      )
    )
    .then((packageTransformers) => {
      packageTransformers = packageTransformers
      .reduce(
        (combined, packageTransformer) =>
          combined.concat(packageTransformer),
        []
      );
      return packageTransformers;
    })
  );
}
