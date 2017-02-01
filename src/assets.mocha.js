'use strict';

const assert = require('assert');
const sinon = require('sinon');
const Knifecycle = require('knifecycle').default;
const initBuildPackageAssets = require('./assets');
const YError = require('yerror');

describe('buildPackageAssets', () => {
  const DEPENDENCIES = [
    'buildPackageAssets', 'fs', 'log', 'require'
  ];
  let $;
  let readFileStub;
  let writeFileStub;
  let requireStub;
  let globStub;

  beforeEach(() => {
    readFileStub = sinon.stub();
    writeFileStub = sinon.stub();
    requireStub = sinon.stub();
    globStub = sinon.stub();

    $ = new Knifecycle();
    $.constant('ENV', {});
    $.constant('log', sinon.stub());
    $.constant('glob', globStub);
    $.constant('PROJECT_DIR', 'project/dir');
    $.constant('fs', {
      readFileAsync: readFileStub,
      writeFileAsync: writeFileStub
    });
    $.constant('require', requireStub);
    initBuildPackageAssets($);
  });

  it('should work when data changed', (done) => {
    const packageConf = {};

    requireStub.returns(function injectFreedom(file, packageConf) {
      file.data = '{\n  "private": false\n}';
      return file;
    })
    readFileStub.onFirstCall().returns(Promise.resolve('{\n  "test": true\n}'));
    readFileStub.onFirstCall().returns(Promise.resolve('{\n  "private": true\n}'));
    writeFileStub.returns(Promise.resolve());
    globStub.returns(Promise.resolve(['lol']));

    $.run(DEPENDENCIES)
    .then(({ require, log, fs, buildPackageAssets }) => {
      return buildPackageAssets(
        packageConf,
        ['metapak-http-server'],
        {
          'metapak-http-server': ['_common']
        }
      )
      .then((result) => {
        assert.deepEqual(require.args, [[
          'project/dir/node_modules/metapak-http-server/_common/assets.js'
        ]]);
        assert.deepEqual(readFileStub.args, [[
          'project/dir/lol',
          'utf-8'
        ], [
          'project/dir/node_modules/metapak-http-server/_common/assets/lol',
          'utf-8'
        ]]);
        assert.deepEqual(writeFileStub.args, [[
          'project/dir/lol',
          '{\n  "private": false\n}',
          'utf-8'
        ]]);
        assert.deepEqual(log.args, [[
          'debug',
          'Processing asset:',
          'project/dir/node_modules/metapak-http-server/_common/assets/lol'
        ]]);
        assert.equal(result, true, 'Indicates that data changed');
      });
    })
    .then(done)
    .catch(done);
  });

  it('should work when data changed', (done) => {
    const packageConf = {};

    requireStub.returns(function injectFreedom(file, packageConf) {
      file.data = '{\n  "private": true\n}';
      return file;
    })
    readFileStub.onFirstCall().returns(Promise.resolve('{\n  "test": true\n}'));
    readFileStub.onFirstCall().returns(Promise.resolve('{\n  "private": true\n}'));
    writeFileStub.returns(Promise.resolve());
    globStub.returns(Promise.resolve(['lol']));

    $.run(DEPENDENCIES)
    .then(({ require, log, fs, buildPackageAssets }) => {
      return buildPackageAssets(
        packageConf,
        ['metapak-http-server'],
        {
          'metapak-http-server': ['_common']
        }
      )
      .then((result) => {
        assert.deepEqual(require.args, [[
          'project/dir/node_modules/metapak-http-server/_common/assets.js'
        ]]);
        assert.deepEqual(readFileStub.args, [[
          'project/dir/lol',
          'utf-8'
        ], [
          'project/dir/node_modules/metapak-http-server/_common/assets/lol',
          'utf-8'
        ]]);
        assert.deepEqual(writeFileStub.args, [], 'Writes nothing.');
        assert.deepEqual(log.args, [[
          'debug',
          'Processing asset:',
          'project/dir/node_modules/metapak-http-server/_common/assets/lol'
        ]]);
        assert.equal(result, false, 'Indicates that datadid not change');
      });
    })
    .then(done)
    .catch(done);
  });
});
