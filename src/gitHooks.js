'use strict';

const { inject, service } = require('knifecycle');
const {
  buildMetapakModulePath,
  mapConfigsSequentially,
  identity,
} = require('./utils');
const path = require('path');

module.exports = initBuildPackageGitHooks;

function initBuildPackageGitHooks($) {
  $.register(
    service(
      'buildPackageGitHooks',
      inject(
        ['ENV', 'PROJECT_DIR', 'GIT_HOOKS_DIR', 'fs', 'log', 'os', 'require'],
        services => Promise.resolve(buildPackageGitHooks.bind(null, services))
      )
    )
  );
}

function buildPackageGitHooks(
  { ENV, PROJECT_DIR, GIT_HOOKS_DIR, fs, os, log, require },
  packageConf,
  metapakModulesSequence,
  metapakModulesConfigs
) {
  // Avoiding CI since it does not make sense
  if (ENV.CI) {
    return Promise.resolve();
  }

  return mapConfigsSequentially(
    metapakModulesSequence,
    metapakModulesConfigs,
    (metapakModuleName, metapakModuleConfig) => {
      const packageHooksPath = buildMetapakModulePath(
        PROJECT_DIR,
        packageConf,
        metapakModuleName,
        'src',
        metapakModuleConfig,
        'hooks.js'
      );
      try {
        return require(packageHooksPath);
      } catch (err) {
        log('debug', 'No hooks found at:', packageHooksPath);
        log('stack', err.stack);
      }
      return identity;
    }
  )
    .then(hooksBuilders => {
      hooksBuilders = hooksBuilders.reduce(
        (hooks, hooksBuilder) => hooksBuilder(hooks, packageConf),
        {}
      );
      return hooksBuilders;
    })
    .then(hooks =>
      Promise.all(
        Object.keys(hooks).map(hookName => {
          const hookContent =
            '#!/bin/sh' +
            os.EOL +
            '# Automagically generated by metapak, do not change in place.' +
            os.EOL +
            '# Your changes would be loose on the next npm install run.' +
            os.EOL +
            hooks[hookName].join(';' + os.EOL);
          const hookPath = path.join(GIT_HOOKS_DIR, hookName);

          return fs
            .readFileAsync(hookPath, 'utf-8')
            .catch(err => {
              log('debug', 'No existing hook found:', hookPath);
              log('stack', err.stack);
              return '';
            })
            .then(
              currentHookContent =>
                currentHookContent === hookContent ||
                fs.writeFileAsync(hookPath, hookContent, {
                  mode: 0o777,
                })
            );
        })
      )
    );
}
