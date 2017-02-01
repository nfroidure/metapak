'use strict';

const assert = require('assert');
const sinon = require('sinon');
const Knifecycle = require('knifecycle').default;
const initBuildPackageConf = require('./packageConf');
const YError = require('yerror');

describe('buildPackageConf', () => {
  const DEPENDENCIES = [
    'buildPackageConf', 'fs', 'log', 'require'
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
    $.constant('fs', {
      writeFileAsync: writeFileStub
    });
    $.constant('require', requireStub);
    initBuildPackageConf($);
  });

  it('should work with one module and one config', (done) => {
    const packageConf = {};

    requireStub.returns(function (packageConf) {
      packageConf.private = true;
      return packageConf;
    })
    writeFileStub.returns(Promise.resolve());

    $.run(DEPENDENCIES)
    .then(({ require, log, fs, buildPackageConf }) => {
      return buildPackageConf(
        packageConf,
        ['metapak-http-server'],
        {
          'metapak-http-server': ['_common']
        }
      )
      .then((result) => {
        assert.deepEqual(require.args, [[
          'project/dir/node_modules/metapak-http-server/_common/package.js'
        ]]);
        assert.deepEqual(writeFileStub.args, [[
          'project/dir/package.json',
          '{\n  "private": true\n}',
          'utf-8'
        ]]);
        assert.deepEqual(log.args.filter(e => e[0] !== 'stack'), []);
        assert.equal(result, true, 'Package conf changed.');
      });
    })
    .then(done)
    .catch(done);
  });

  it('should work with no tranformations', (done) => {
    const packageConf = {};

    requireStub.throws(new Error('E_ERROR'));
    writeFileStub.returns(Promise.resolve());

    $.run(DEPENDENCIES)
    .then(({ require, log, fs, buildPackageConf }) => {
      return buildPackageConf(
        packageConf,
        ['metapak-http-server'],
        {
          'metapak-http-server': ['_common']
        }
      )
      .then((result) => {
        assert.deepEqual(require.args, [[
          'project/dir/node_modules/metapak-http-server/_common/package.js'
        ]]);
        assert.deepEqual(writeFileStub.args, []);
        assert.deepEqual(log.args.filter(e => e[0] !== 'stack'), [[
          'debug',
          'No package tranformation found at:',
          'project/dir/node_modules/metapak-http-server/_common/package.js'
        ]]);
        assert.equal(result, false, 'Package conf did not change.');
      });
    })
    .then(done)
    .catch(done);
  });

  it('should work with several modules and configs', (done) => {
    const packageConf = {};

    requireStub.onFirstCall().returns(function (packageConf) {
      packageConf.private = true;
      return packageConf;
    });
    requireStub.onSecondCall().returns(function (packageConf) {
      packageConf.license = 'MIT';
      return packageConf;
    });
    requireStub.onThirdCall().returns(function (packageConf) {
      packageConf.author = 'John Doe';
      return packageConf;
    });
    writeFileStub.returns(Promise.resolve());

    $.run(DEPENDENCIES)
    .then(({ require, log, fs, buildPackageConf }) => {
      return buildPackageConf(
        packageConf,
        ['metapak-http-server', 'metapak-schmilbik'],
        {
          'metapak-http-server': ['_common'],
          'metapak-schmilbik': ['_common', 'author']
        }
      )
      .then((result) => {
        assert.deepEqual(require.args, [[
          'project/dir/node_modules/metapak-http-server/_common/package.js'
        ], [
          'project/dir/node_modules/metapak-schmilbik/_common/package.js'
        ], [
          'project/dir/node_modules/metapak-schmilbik/author/package.js'
        ]]);
        assert.deepEqual(writeFileStub.args, [[
          'project/dir/package.json',
          '{\n  "private": true,\n  "license": "MIT",\n  "author": "John Doe"\n}',
          'utf-8'
        ]]);
        assert.deepEqual(log.args.filter(e => e[0] !== 'stack'), []);
        assert.equal(result, true, 'Package conf changed.');
      });
    })
    .then(done)
    .catch(done);
  });
});
