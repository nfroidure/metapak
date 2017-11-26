'use strict';

const path = require('path');
const Promise = require('bluebird');
const YError = require('yerror');
const {
  buildMetapakModulePath,
} = require('./utils');

const MAX_PACKAGE_BUILD_ITERATIONS = 15;

module.exports = runMetapak;

function runMetapak({
  ENV, PROJECT_DIR,
  log, exit, fs,
  buildPackageConf, buildPackageAssets, buildPackageGitHooks,
}) {
  return _loadJSONFile({ fs }, path.join(PROJECT_DIR, 'package.json'))
  .then((packageConf) => {
    const metapackConfigsSequence = ['_common'].concat(
      packageConf.metapak && packageConf.metapak.configs ?
      packageConf.metapak.configs :
      []
    );
    let metapakModulesSequence = _getMetapakModulesSequence(
      { log, exit }, packageConf
    );

    if(!metapakModulesSequence.length) {
      log('debug', 'No metapak modules found.');
    } else {
      log('debug', 'Resolved the metapak modules sequence:', metapakModulesSequence);
    }

    return _getPackageMetapakModulesConfigs({
      PROJECT_DIR, fs, log,
    }, packageConf, metapakModulesSequence, metapackConfigsSequence)
    .then(metapakModulesConfigs => Promise.all([
      metapakModulesConfigs,
      recursivelyBuild(0, buildPackageConf, [
        packageConf,
        metapakModulesSequence,
        metapakModulesConfigs,
      ]),
    ]))
    .then(([metapakModulesConfigs, buildPackageConfResult]) => {
      const promises = [
        Promise.resolve(buildPackageConfResult),
        buildPackageAssets(packageConf, metapakModulesSequence, metapakModulesConfigs),
        buildPackageGitHooks(packageConf, metapakModulesSequence, metapakModulesConfigs),
      ];

      // Trick to avoid stopping the process immediately for one failure
      return _awaitPromisesFullfil(promises);
    })
    .then(([packageConfModified, assetsModified, gitHooksAdded]) => {
      // The CI should not modify the repo contents and should fail when the
      // package would have been modified cause it should not happen and it probably
      // is a metapak misuse.
      if((packageConfModified || assetsModified) && ENV.CI) {
        log('error', '💀 - This commit is not valid since it do not match the meta package state.');
        exit(1);
      }
      if(packageConfModified) {
        log(
          'info',
          '🚧 - The project package.json changed, you may want' +
          ' to `npm install` again to install new dependencies.'
        );
      }
      if(assetsModified) {
        log('info', '🚧 - Some assets were added to the project, you may want to stage them.');
      }
    });
  })
  .then(() => exit(0))
  .catch((err) => {
    err = YError.cast(err);
    log('error', '💀 - Could not run metapak script correctly:', err.code, err.params);
    log('info', '💊 - Debug by running again with "DEBUG=metapak" env.');
    log('stack', err.stack);
    exit(1);
  });
}

function _loadJSONFile({ fs, log }, path) {
  return fs.readFileAsync(path, 'utf-8')
  .catch((err) => { throw YError.wrap(err, 'E_PACKAGE_NOT_FOUND', path); })
  .then(_parseJSON.bind(null, { log }, path));
}

function _parseJSON({ log }, path, json) {
  return Promise.resolve(json)
  .then(JSON.parse.bind(JSON))
  .catch((err) => {
    throw YError.wrap(err, 'E_MALFORMED_PACKAGE', path);
  });
}

function _getMetapakModulesSequence({ log, exit }, packageConf) {
  const metapakModulesNames = Object.keys(packageConf.devDependencies || {})
  .filter(devDependency => devDependency.startsWith('metapak-'));

  // Allowing a metapak module to run on himself
  if(packageConf.name && packageConf.name.startsWith('metapak-')) {
    metapakModulesNames.unshift(packageConf.name);
  }

  return _reorderMetapakModulesNames(
    { log, exit },
    packageConf,
    metapakModulesNames
  );
}

function _reorderMetapakModulesNames({ log, exit }, packageConf, metapakModulesNames) {
  if(packageConf.metapak && packageConf.metapak.sequence) {
    if(!(packageConf.metapak.sequence instanceof Array)) {
      throw new YError(
        'E_BAD_SEQUENCE_TYPE',
        typeof packageConf.metapak.sequence,
        packageConf.metapak.sequence
      );
    }
    packageConf.metapak.sequence
    .forEach((moduleName) => {
      if(!metapakModulesNames.includes(moduleName)) {
        throw new YError('E_BAD_SEQUENCE_ITEM', moduleName);
      }
    });
    log('debug', 'Reordering metapak modules sequence.', packageConf.metapak.sequence);
    return packageConf.metapak.sequence;
  }
  return metapakModulesNames;
}

function _getPackageMetapakModulesConfigs({
  PROJECT_DIR, fs, log,
}, packageConf, metapakModulesSequence, metapackConfigsSequence) {
  return Promise.props(
    metapakModulesSequence
    .reduce((metapakModulesConfigs, metapakModuleName) => {
      metapakModulesConfigs[metapakModuleName] = fs.readdirAsync(
        buildMetapakModulePath(PROJECT_DIR, packageConf, metapakModuleName, 'src')
      )
      .then((metapakModuleConfigs) => {
        metapakModuleConfigs = metapakModuleConfigs
        .filter(metapakModuleConfig => metapackConfigsSequence.includes(metapakModuleConfig));
        log(
          'debug', 'Found configs for "' + metapakModuleName + '":',
          metapakModuleConfigs
        );
        return metapakModuleConfigs;
      });
      return metapakModulesConfigs;
    }, {})
  );
}

function _awaitPromisesFullfil(promises) {
  let err;

  return Promise.all(promises.map(
    promise => promise.catch((inErr) => {
      err = err || inErr;
    })
  ))
  .then((result) => {
    if(err) {
      throw err;
    }
    return result;
  });
}

function recursivelyBuild(iteration, fn, args) {
  return fn(...args)
  .then((result) => {
    if(!result) {
      return !!iteration;
    }
    if(MAX_PACKAGE_BUILD_ITERATIONS <= iteration) {
      throw new YError('E_MAX_ITERATIONS', iteration, MAX_PACKAGE_BUILD_ITERATIONS);
    }
    return recursivelyBuild(++iteration, fn, args);
  });
}
