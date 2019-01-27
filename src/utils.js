const path = require('path');
const chalk = require('chalk');
const diff = require('diff');

module.exports = {
  identity: x => x,
  buildMetapakModulePath,
  mapConfigsSequentially,
  buildDiff,
};

function buildMetapakModulePath(
  PROJECT_DIR,
  packageConf,
  metapakModuleName,
  ...parts
) {
  // Take in count the edge case of self applying metapak module
  parts = [PROJECT_DIR]
    .concat(
      packageConf.name !== metapakModuleName
        ? ['node_modules', metapakModuleName]
        : []
    )
    .concat(parts);
  return path.join(...parts);
}

async function mapConfigsSequentially(
  metapakModulesSequence,
  metapakModulesConfigs,
  fn
) {
  const packageTransformers = await Promise.all(
    metapakModulesSequence.map(metapakModuleName =>
      Promise.all(
        metapakModulesConfigs[metapakModuleName].map(metapakModuleConfig =>
          fn(metapakModuleName, metapakModuleConfig)
        )
      )
    )
  );

  return packageTransformers.reduce(
    (combined, packageTransformer) => combined.concat(packageTransformer),
    []
  );
}

function buildDiff(newData, originalDate) {
  return diff
    .diffJson(originalDate, newData, {})
    .map(part =>
      (part.added ? chalk.green : part.removed ? chalk.red : chalk.grey)(
        part.value
      )
    )
    .join('');
}
