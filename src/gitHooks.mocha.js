'use strict';

const assert = require('assert');
const sinon = require('sinon');
const Knifecycle = require('knifecycle').default;
const initBuildPackageGitHooks = require('./gitHooks');

function filterLogs(e) { return 'stack' !== e[0]; }

describe('buildPackageGitHooks', () => {
  const DEPENDENCIES = [
    'buildPackageGitHooks', 'fs', 'log', 'require',
  ];
  let $;
  let writeFileStub;
  let requireStub;

  beforeEach(() => {
    writeFileStub = sinon.stub();
    requireStub = sinon.stub();

    $ = new Knifecycle();
    $.constant('ENV', {});
    $.constant('log', sinon.stub());
    $.constant('PROJECT_DIR', 'project/dir');
    $.constant('GIT_HOOKS_DIR', '.git/hooks');
    $.constant('os', { EOL: '\n' });
    $.constant('fs', {
      writeFileAsync: writeFileStub,
    });
    $.constant('require', requireStub);
    initBuildPackageGitHooks($);
  });

  it('should work with one module and one config', (done) => {
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
    writeFileStub.returns(Promise.resolve());

    $.run(DEPENDENCIES)
    .then(({ require, log, fs, buildPackageGitHooks }) =>
      buildPackageGitHooks(
        {},
        ['metapak-nfroidure', 'metapak-fantasia'],
        {
          'metapak-nfroidure': ['_common', 'lol'],
          'metapak-fantasia': ['_common', 'test'],
        }
      )
      .then(() => {
        assert.deepEqual(require.args, [[
          'project/dir/node_modules/metapak-nfroidure/src/_common/hooks.js',
        ], [
          'project/dir/node_modules/metapak-nfroidure/src/lol/hooks.js',
        ], [
          'project/dir/node_modules/metapak-fantasia/src/_common/hooks.js',
        ], [
          'project/dir/node_modules/metapak-fantasia/src/test/hooks.js',
        ]]);
        assert.deepEqual(writeFileStub.args, [[
          '.git/hooks/pre-commit',
          '#!/bin/sh\n' +
          '# Automagically generated by metapak, do not change in place.\n' +
          '# Your changes would be loose on the next npm install run.\n' +
          'npm run test && npm run lint || exit 1;\n' +
          'npm run coveralls',
          { mode: 511 },
        ]]);
        assert.deepEqual(log.args.filter(filterLogs), [[
          'debug',
          'No hooks found at:',
          'project/dir/node_modules/metapak-nfroidure/src/lol/hooks.js',
        ], [
          'debug',
          'No hooks found at:',
          'project/dir/node_modules/metapak-fantasia/src/test/hooks.js',
        ]]);
      })
    )
    .then(done)
    .catch(done);
  });
});
