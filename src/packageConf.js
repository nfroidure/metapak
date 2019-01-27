const { autoHandler } = require('knifecycle');
const sortKeys = require('sort-keys');
// TODO: Remove by https://nodejs.org/api/util.html#util_util_isdeepstrictequal_val1_val2
// when supporting only Node 10+
const isDeepStrictEqual = require('deep-strict-equal');
const path = require('path');
const {
  buildMetapakModulePath,
  mapConfigsSequentially,
  identity,
  buildDiff,
} = require('./utils');

const METAPAK_SCRIPT = 'metapak';

module.exports = autoHandler(initBuildPackageConf);

async function initBuildPackageConf(
  { ENV, PROJECT_DIR, fs, require, log },
  packageConf,
  metapakModulesSequence,
  metapakModulesConfigs
) {
  const originalDependencies = Object.keys(packageConf.dependencies || {});
  const originalPackageConf = JSON.stringify(packageConf, null, 2);

  const packageTransformers = await mapConfigsSequentially(
    metapakModulesSequence,
    metapakModulesConfigs,
    async (metapakModuleName, metapakModuleConfig) => {
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
        log(
          'debug',
          'No package tranformation found at:',
          packageTransformPath
        );
        log('stack', err.stack);
      }
      return identity;
    }
  );

  let newPackageConf;

  // Adding the `metapak` postinstall script via an idempotent way
  packageConf.scripts = packageConf.scripts || {};
  if ('metapak' !== packageConf.name) {
    packageConf.scripts.metapak = METAPAK_SCRIPT;
  }
  newPackageConf = packageTransformers.reduce(
    (newPackageConf, packageTransformer) => packageTransformer(newPackageConf),
    packageConf
  );
  if (
    Object.keys(newPackageConf.dependencies || {})
      .sort()
      .join() !== originalDependencies.join()
  ) {
    log('warn', 'Changing dependencies with metapak is not recommended!');
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

  if (ENV.DEBUG === 'metapak') {
    log('debug', buildDiff(originalPackageConf, data));
  }

  log('debug', 'Saving the package:', path.join(PROJECT_DIR, 'package.json'));
  await fs.writeFileAsync(
    path.join(PROJECT_DIR, 'package.json'),
    data,
    'utf-8'
  );
  return true;
}
