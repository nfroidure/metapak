const path = require('path');
const Promise = require('bluebird');
const YError = require('yerror').default;
const { autoService } = require('knifecycle');

const MAX_PACKAGE_BUILD_ITERATIONS = 15;

module.exports = autoService(initMetapak);

async function initMetapak({
  ENV,
  PROJECT_DIR,
  log,
  exit,
  fs,
  buildPackageConf,
  buildPackageAssets,
  buildPackageGitHooks,
  resolveModule,
}) {
  return async function metapak() {
    try {
      const packageConf = await _loadJSONFile(
        { fs },
        path.join(PROJECT_DIR, 'package.json')
      );

      const metapackConfigsSequence = ['_common'].concat(
        packageConf.metapak && packageConf.metapak.configs
          ? packageConf.metapak.configs
          : []
      );
      let metapakModulesSequence = _getMetapakModulesSequence(
        { log, exit },
        packageConf
      );

      if (!metapakModulesSequence.length) {
        log('debug', 'No metapak modules found.');
      } else {
        log(
          'debug',
          'Resolved the metapak modules sequence:',
          metapakModulesSequence
        );
      }

      const metapakModulesConfigs = await _getPackageMetapakModulesConfigs(
        {
          PROJECT_DIR,
          fs,
          log,
        },
        metapakModulesSequence,
        metapackConfigsSequence,
        resolveModule,
        packageConf
      );

      const buildPackageConfResult = await recursivelyBuild(
        0,
        buildPackageConf,
        [packageConf, metapakModulesSequence, metapakModulesConfigs]
      );

      const promises = [
        Promise.resolve(buildPackageConfResult),
        buildPackageAssets(
          packageConf,
          metapakModulesSequence,
          metapakModulesConfigs
        ),
        buildPackageGitHooks(
          packageConf,
          metapakModulesSequence,
          metapakModulesConfigs
        ),
      ];

      // Trick to avoid stopping the process immediately for one failure
      const [packageConfModified, assetsModified] = await _awaitPromisesFullfil(
        promises
      );

      // The CI should not modify the repo contents and should fail when the
      // package would have been modified cause it should not happen and it probably
      // is a metapak misuse.
      if ((packageConfModified || assetsModified) && ENV.CI) {
        log(
          'error',
          '💀 - This commit is not valid since it do not match the meta package state.'
        );
        exit(1);
      }
      if (packageConfModified) {
        log(
          'info',
          '🚧 - The project package.json changed, you may want' +
            ' to `npm install` again to install new dependencies.'
        );
      }
      if (assetsModified) {
        log(
          'info',
          '🚧 - Some assets were added to the project, you may want to stage them.'
        );
      }
      exit(0);
    } catch (err) {
      const castedErr = YError.cast(err);

      log(
        'error',
        '💀 - Could not run metapak script correctly:',
        castedErr.code,
        castedErr.params
      );
      log('info', '💊 - Debug by running again with "DEBUG=metapak" env.');
      log('stack', castedErr.stack);
      exit(1);
    }
  };
}

function _loadJSONFile({ fs, log }, path) {
  return fs
    .readFileAsync(path, 'utf-8')
    .catch((err) => {
      throw YError.wrap(err, 'E_PACKAGE_NOT_FOUND', path);
    })
    .then(_parseJSON.bind(null, { log }, path));
}

function _parseJSON(_, path, json) {
  return Promise.resolve(json)
    .then(JSON.parse.bind(JSON))
    .catch((err) => {
      throw YError.wrap(err, 'E_MALFORMED_PACKAGE', path);
    });
}

function _getMetapakModulesSequence({ log, exit }, packageConf) {
  const reg = new RegExp(/^(@.+\/)?metapak-/);
  const metapakModulesNames = Object.keys(
    packageConf.devDependencies || {}
  ).filter((devDependency) => reg.test(devDependency));

  // Allowing a metapak module to run on himself
  if (packageConf.name && reg.test(packageConf.name)) {
    metapakModulesNames.unshift(packageConf.name);
  }

  return _reorderMetapakModulesNames(
    { log, exit },
    packageConf,
    metapakModulesNames
  );
}

function _reorderMetapakModulesNames(
  { log },
  packageConf,
  metapakModulesNames
) {
  if (packageConf.metapak && packageConf.metapak.sequence) {
    if (!(packageConf.metapak.sequence instanceof Array)) {
      throw new YError(
        'E_BAD_SEQUENCE_TYPE',
        typeof packageConf.metapak.sequence,
        packageConf.metapak.sequence
      );
    }
    packageConf.metapak.sequence.forEach((moduleName) => {
      if (!metapakModulesNames.includes(moduleName)) {
        throw new YError('E_BAD_SEQUENCE_ITEM', moduleName);
      }
    });
    log(
      'debug',
      'Reordering metapak modules sequence.',
      packageConf.metapak.sequence
    );
    return packageConf.metapak.sequence;
  }
  return metapakModulesNames;
}

function _getPackageMetapakModulesConfigs(
  { fs, log },
  metapakModulesSequence,
  metapackConfigsSequence,
  resolveModule,
  packageConf
) {
  return Promise.props(
    metapakModulesSequence.reduce(
      (metapakModulesConfigs, metapakModuleName) => {
        const modulePath = path.join(
          resolveModule(metapakModuleName, packageConf),
          'src'
        );

        metapakModulesConfigs[metapakModuleName] = fs
          .readdirAsync(modulePath)
          .then((metapakModuleConfigs) => {
            metapakModuleConfigs = metapackConfigsSequence.filter(
              (metapakModuleConfig) =>
                metapakModuleConfigs.includes(metapakModuleConfig)
            );
            log(
              'debug',
              'Found configs for "' + metapakModuleName + '":',
              metapakModuleConfigs
            );
            return metapakModuleConfigs;
          });
        return metapakModulesConfigs;
      },
      {}
    )
  );
}

function _awaitPromisesFullfil(promises) {
  let err;

  return Promise.all(
    promises.map((promise) =>
      promise.catch((inErr) => {
        err = err || inErr;
      })
    )
  ).then((result) => {
    if (err) {
      throw err;
    }
    return result;
  });
}

function recursivelyBuild(iteration, fn, args) {
  return fn(...args).then((result) => {
    if (!result) {
      return !!iteration;
    }
    if (MAX_PACKAGE_BUILD_ITERATIONS <= iteration) {
      throw new YError(
        'E_MAX_ITERATIONS',
        iteration,
        MAX_PACKAGE_BUILD_ITERATIONS
      );
    }
    return recursivelyBuild(++iteration, fn, args);
  });
}
