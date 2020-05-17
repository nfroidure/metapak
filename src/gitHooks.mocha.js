'use strict';

const assert = require('assert');
const sinon = require('sinon');
const { default: Knifecycle, constant } = require('knifecycle');
const initBuildPackageGitHooks = require('./gitHooks');

function filterLogs(e) {
  return 'stack' !== e[0];
}

describe('buildPackageGitHooks', () => {
  const DEPENDENCIES = ['buildPackageGitHooks', 'fs', 'log', 'require'];
  let $;
  let writeFileStub;
  let readFileStub;
  let requireStub;

  beforeEach(() => {
    writeFileStub = sinon.stub();
    readFileStub = sinon.stub();
    requireStub = sinon.stub();

    $ = new Knifecycle();
    $.register(constant('log', sinon.stub()));
    $.register(constant('PROJECT_DIR', '/home/whoiam/project/dir'));
    $.register(constant('os', { EOL: '\n' }));
    $.register(
      constant('fs', {
        readFileAsync: readFileStub,
        writeFileAsync: writeFileStub,
      })
    );
    $.register(constant('require', requireStub));
    $.register(
      constant(
        'resolveModule',
        (moduleName) => `/home/whoiam/project/dir/node_modules/${moduleName}`
      )
    );
    $.register(initBuildPackageGitHooks);
  });

  it('should work with one module and one config', (done) => {
    $.register(constant('ENV', {}));
    $.register(
      constant('GIT_HOOKS_DIR', '/home/whoiam/project/dir/.git/hooks')
    );

    requireStub.onCall(0).returns((hooks) => {
      hooks['pre-commit'] = hooks['pre-commit'] || [];
      hooks['pre-commit'].push('npm run test && npm run lint || exit 1');
      return hooks;
    });
    requireStub.onCall(1).throws(new Error('E_ERROR_1'));
    requireStub.onCall(2).returns((hooks) => {
      hooks['pre-commit'] = hooks['pre-commit'] || [];
      hooks['pre-commit'].push('npm run coveralls');
      return hooks;
    });
    requireStub.onCall(3).throws(new Error('E_ERROR_2'));
    readFileStub.returns(Promise.resolve(''));
    writeFileStub.returns(Promise.resolve());

    $.run(DEPENDENCIES)
      .then(({ require, log, buildPackageGitHooks }) =>
        buildPackageGitHooks({}, ['metapak-nfroidure', 'metapak-fantasia'], {
          'metapak-nfroidure': ['_common', 'lol'],
          'metapak-fantasia': ['_common', 'test'],
        }).then(() => {
          assert.deepEqual(require.args, [
            [
              '/home/whoiam/project/dir/node_modules/metapak-nfroidure/src/_common/hooks.js',
            ],
            [
              '/home/whoiam/project/dir/node_modules/metapak-nfroidure/src/lol/hooks.js',
            ],
            [
              '/home/whoiam/project/dir/node_modules/metapak-fantasia/src/_common/hooks.js',
            ],
            [
              '/home/whoiam/project/dir/node_modules/metapak-fantasia/src/test/hooks.js',
            ],
          ]);
          assert.deepEqual(writeFileStub.args, [
            [
              '/home/whoiam/project/dir/.git/hooks/pre-commit',
              '#!/bin/sh\n' +
                '# Automagically generated by metapak, do not change in place.\n' +
                '# Your changes would be loose on the next npm install run.\n' +
                'npm run test && npm run lint || exit 1;\n' +
                'npm run coveralls',
              { mode: 511 },
            ],
          ]);
          assert.deepEqual(log.args.filter(filterLogs), [
            [
              'debug',
              'No hooks found at:',
              '/home/whoiam/project/dir/node_modules/metapak-nfroidure/src/lol/hooks.js',
            ],
            [
              'debug',
              'No hooks found at:',
              '/home/whoiam/project/dir/node_modules/metapak-fantasia/src/test/hooks.js',
            ],
          ]);
        })
      )
      .then(done)
      .catch(done);
  });

  it('should not run on CI', (done) => {
    $.register(
      constant('ENV', {
        CI: 1,
      })
    );
    $.register(
      constant('GIT_HOOKS_DIR', '/home/whoiam/project/dir/.git/hooks')
    );

    requireStub.onCall(0).returns((hooks) => {
      hooks['pre-commit'] = hooks['pre-commit'] || [];
      hooks['pre-commit'].push('npm run test && npm run lint || exit 1');
      return hooks;
    });
    requireStub.onCall(1).throws(new Error('E_ERROR_1'));
    requireStub.onCall(2).returns((hooks) => {
      hooks['pre-commit'] = hooks['pre-commit'] || [];
      hooks['pre-commit'].push('npm run coveralls');
      return hooks;
    });
    requireStub.onCall(3).throws(new Error('E_ERROR_2'));
    readFileStub.returns(Promise.resolve(''));
    writeFileStub.returns(Promise.resolve());

    $.run(DEPENDENCIES)
      .then(({ require, log, buildPackageGitHooks }) =>
        buildPackageGitHooks({}, ['metapak-nfroidure', 'metapak-fantasia'], {
          'metapak-nfroidure': ['_common', 'lol'],
          'metapak-fantasia': ['_common', 'test'],
        }).then(() => {
          assert.deepEqual(require.args, []);
          assert.deepEqual(writeFileStub.args, []);
          assert.deepEqual(log.args.filter(filterLogs), []);
        })
      )
      .then(done)
      .catch(done);
  });

  it('should not run on parent git repository', (done) => {
    $.register(constant('ENV', {}));
    $.register(constant('GIT_HOOKS_DIR', '/home/whoiam/project/.git/hooks'));

    requireStub.onCall(0).returns((hooks) => {
      hooks['pre-commit'] = hooks['pre-commit'] || [];
      hooks['pre-commit'].push('npm run test && npm run lint || exit 1');
      return hooks;
    });
    requireStub.onCall(1).throws(new Error('E_ERROR_1'));
    requireStub.onCall(2).returns((hooks) => {
      hooks['pre-commit'] = hooks['pre-commit'] || [];
      hooks['pre-commit'].push('npm run coveralls');
      return hooks;
    });
    requireStub.onCall(3).throws(new Error('E_ERROR_2'));
    readFileStub.returns(Promise.resolve(''));
    writeFileStub.returns(Promise.resolve());

    $.run(DEPENDENCIES)
      .then(({ require, log, buildPackageGitHooks }) =>
        buildPackageGitHooks({}, ['metapak-nfroidure', 'metapak-fantasia'], {
          'metapak-nfroidure': ['_common', 'lol'],
          'metapak-fantasia': ['_common', 'test'],
        }).then(() => {
          assert.deepEqual(require.args, []);
          assert.deepEqual(writeFileStub.args, []);
          assert.deepEqual(log.args.filter(filterLogs), []);
        })
      )
      .then(done)
      .catch(done);
  });
});
