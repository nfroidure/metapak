const chalk = require('chalk');
const diff = require('diff');

module.exports = {
  identity: (x) => x,
  mapConfigsSequentially,
  buildDiff,
};

async function mapConfigsSequentially(
  metapakModulesSequence,
  metapakModulesConfigs,
  fn
) {
  const packageTransformers = await Promise.all(
    metapakModulesSequence.map((metapakModuleName) =>
      Promise.all(
        metapakModulesConfigs[metapakModuleName].map((metapakModuleConfig) =>
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
    .map((part) =>
      (part.added ? chalk.green : part.removed ? chalk.red : chalk.grey)(
        part.value
      )
    )
    .join('');
}
