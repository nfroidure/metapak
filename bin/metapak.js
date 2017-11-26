#! /usr/bin/env node

'use strict';

const Knifecycle = require('knifecycle').default;
const { inject } = require('knifecycle/dist/util');
const debug = require('debug')('metapak');
const fs = require('fs');
const YError = require('yerror');
const os = require('os');
const mkdirp = require('mkdirp');
const path = require('path');
const glob = require('glob');
const program = require('commander');
const Promise = require('bluebird');
const { exec } = require('child_process');

const runMetapak = require('../src/metapak');
const initBuildPackageConf = require('../src/packageConf');
const initBuildPackageAssets = require('../src/assets');
const initBuildPackageGitHooks = require('../src/gitHooks');

const $ = new Knifecycle();

$.constant('ENV', process.env);
$.service('PROJECT_DIR',
  inject([
    'log', 'fs',
  ], ({
    log, fs,
  }) => new Promise((resolve, reject) => {
    const projectDir = path.join(__dirname, '..', '..', '..');

    // Here we assume that if a `node_modules` folder exists
    // in the directory, we must be inside a module
    fs.accessAsync(path.join(projectDir, 'node_modules'), fs.constants.R_OK)
    .then(() => {
      log('debug', 'Found the project dir:', projectDir);
      resolve(projectDir);
    })
    .catch((err) => {
      const metapakDir = path.join(__dirname, '..');

      log(
        'debug',
        'Project dir does not exist, assuming we are running on' +
        ' `metapak` itself:', metapakDir);
      log('stack', err.stack);
      resolve(metapakDir);
    });
  })
));

$.service('GIT_HOOKS_DIR',
  inject([
    'PROJECT_DIR', 'log',
  ], ({
    PROJECT_DIR, log,
  }) => new Promise((resolve, reject) => {
    exec('echo `git rev-parse --git-dir`/hooks', {
      cwd: PROJECT_DIR,
    }, (err, stdout, stderr) => {
      const outputPath = stdout.toString().trim();
      const GIT_HOOKS_DIR = path.isAbsolute(outputPath) ?
        outputPath :
        path.join(PROJECT_DIR, outputPath);

      if(err || !stdout) {
        log('debug', 'Could not find hooks dir.', err ? err.stack : '');
        log('debug', 'stdout:', stdout);
        log('debug', 'stderr:', stderr);
        resolve('');
        return;
      }
      log('debug', 'Found hooks dir:', GIT_HOOKS_DIR);

      // Check the dir exists in order to avoid bugs in non-git
      // envs (docker images for instance)
      fs.accessAsync(GIT_HOOKS_DIR, fs.constants.W_OK)
      .then(() => {
        log('debug', 'Hooks dir exists:', GIT_HOOKS_DIR);
        resolve(GIT_HOOKS_DIR);
      })
      .catch((err2) => {
        log('debug', 'Hooks dir does not exist:', GIT_HOOKS_DIR);
        log('stack', err2.stack);
        resolve('');
      });
    });
  })
));

$.constant('require', require);
$.constant('exit', process.exit);
$.constant('mkdirp', Promise.promisify(mkdirp));
$.constant('os', os);
$.constant('glob', Promise.promisify(glob));
$.constant('log', (type, ...args) => {
  if('debug' === type || 'stack' === type) {
    debug(...args);
    return;
  }
  console[type](...args); // eslint-disable-line
});

initBuildPackageConf($);
initBuildPackageAssets($);
initBuildPackageGitHooks($);

program
  .version(require(path.join(__dirname, '..', 'package.json')).version)
  .option('-s, --safe', 'Exit with 1 when changes are detected')
  .option('-d, --dry-run', 'Print the changes without doing it')
  .parse(process.argv);

$.service('mkdirp',
  inject([
    'log',
  ], ({
    log,
  }) => {
    const mkdirpAsync = Promise.promisify(mkdirp.mkdirp);

    return Promise.resolve((path, ...args) => {
      if(program.dryRun) {
        log('debug', 'Create a folder:', path);
        return Promise.resolve();
      }
      return preventChanges(path) ||
        mkdirpAsync(path);
    });
  })
);

$.service('fs',
  inject([
    'log',
  ], ({
    log,
  }) => {
    const baseFS = Promise.promisifyAll(fs);

    return Promise.resolve({
      readFileAsync: baseFS.readFileAsync.bind(baseFS),
      accessAsync: baseFS.accessAsync.bind(baseFS),
      readdirAsync: baseFS.readdirAsync.bind(baseFS),
      unlinkAsync: (path, ...args) => {
        if(program.dryRun) {
          log('debug', 'Delete a file:', path);
          return Promise.resolve();
        }
        return preventChanges(path) ||
          baseFS.unlinkAsync(path, ...args);
      },
      writeFileAsync: (path, ...args) => {
        if(program.dryRun) {
          log('debug', 'Modify a file:', path);
          return Promise.resolve();
        }
        return preventChanges(path) ||
          baseFS.writeFileAsync(path, ...args);
      },
      constants: baseFS.constants,
    });
  })
);

$.run([
  'ENV', 'PROJECT_DIR',
  'log', 'fs', 'exit',
  'buildPackageConf',
  'buildPackageAssets',
  'buildPackageGitHooks',
])
.then(runMetapak)
.catch(console.log.bind(console)); // eslint-disable-line

function preventChanges(path) {
  if(program.safe) {
    return Promise.reject(new YError('E_UNEXPECTED_CHANGES', path));
  }
  return {}.undef;
}
