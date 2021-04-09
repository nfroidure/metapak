const {
  default: Knifecycle,
  constant,
  autoService,
  name,
} = require('knifecycle');
const debug = require('debug')('metapak');
const fs = require('fs');
const YError = require('yerror').default;
const os = require('os');
const mkdirp = require('mkdirp');
const path = require('path');
const glob = require('glob');
const program = require('commander');
const Promise = require('bluebird');
const { exec } = require('child_process');

const initMetapak = require('../src/metapak');
const initBuildPackageConf = require('../src/packageConf');
const initBuildPackageAssets = require('../src/assets');
const initBuildPackageGitHooks = require('../src/gitHooks');
const initProjectDir = require('../src/projectDir');
const initResolveModule = require('../src/resolveModule');

module.exports = { runMetapak, prepareMetapak };

async function runMetapak() {
  try {
    const $ = await prepareMetapak();

    const { metapak } = await $.run(['metapak']);

    await metapak();
  } catch (err) {
    // eslint-disable-next-line
    console.error(err);
    process.exit(1);
  }
}

async function prepareMetapak($ = new Knifecycle()) {
  $.register(initMetapak);
  $.register(constant('ENV', process.env));
  $.register(constant('require', require));
  $.register(constant('exit', process.exit));
  $.register(constant('mkdirp', mkdirp));
  $.register(constant('os', os));
  $.register(constant('glob', Promise.promisify(glob)));
  $.register(
    constant('log', (type, ...args) => {
      if ('debug' === type || 'stack' === type) {
        debug(...args);
        return;
      }
      console[type](...args); // eslint-disable-line
    })
  );
  $.register(name('PROJECT_DIR', initProjectDir));
  $.register(name('GIT_HOOKS_DIR', autoService(initGitHooksDir)));

  $.register(initBuildPackageConf);
  $.register(initBuildPackageAssets);
  $.register(initBuildPackageGitHooks);
  $.register(initResolveModule);

  program
    .version(require(path.join(__dirname, '..', 'package.json')).version)
    .option('-s, --safe', 'Exit with 1 when changes are detected')
    .option('-d, --dry-run', 'Print the changes without doing it')
    .parse(process.argv);

  $.register(
    autoService(async function initProgram({ packageConf }) {
      return program
        .version(packageConf.version)
        .option('-b, --base [value]', 'Base for links')
        .parse(process.argv);
    })
  );

  $.register(autoService(initMkdirp));
  $.register(name('fs', autoService(initFS)));

  return $;
}

function preventChanges(path) {
  if (program.safe) {
    return Promise.reject(new YError('E_UNEXPECTED_CHANGES', path));
  }
  return {}.undef;
}

async function initGitHooksDir({ PROJECT_DIR, log }) {
  return new Promise((resolve) => {
    exec(
      'git rev-parse --git-dir',
      {
        cwd: PROJECT_DIR,
      },
      (err, stdout, stderr) => {
        const outputPath = path.join(stdout.toString().trim(), 'hooks');
        const GIT_HOOKS_DIR = path.isAbsolute(outputPath)
          ? outputPath
          : path.join(PROJECT_DIR, outputPath);

        if (err || !stdout) {
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
      }
    );
  });
}

async function initMkdirp({ log }) {
  const mkdirpAsync = Promise.promisify(mkdirp.mkdirp);

  return Promise.resolve((path, ...args) => {
    if (program.dryRun) {
      log('debug', 'Create a folder:', path);
      return Promise.resolve();
    }
    return preventChanges(path, ...args) || mkdirpAsync(path, ...args);
  });
}

async function initFS({ log }) {
  const baseFS = Promise.promisifyAll(fs);

  return Promise.resolve({
    readFileAsync: baseFS.readFileAsync.bind(baseFS),
    accessAsync: baseFS.accessAsync.bind(baseFS),
    readdirAsync: baseFS.readdirAsync.bind(baseFS),
    unlinkAsync: (path, ...args) => {
      if (program.dryRun) {
        log('debug', 'Delete a file:', path);
        return Promise.resolve();
      }
      return preventChanges(path) || baseFS.unlinkAsync(path, ...args);
    },
    writeFileAsync: (path, ...args) => {
      if (program.dryRun) {
        log('debug', 'Modify a file:', path);
        return Promise.resolve();
      }
      return preventChanges(path) || baseFS.writeFileAsync(path, ...args);
    },
    constants: baseFS.constants,
  });
}
