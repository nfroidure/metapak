'use strict';

const assert = require('assert');
const sinon = require('sinon');
const { default: Knifecycle, constant } = require('knifecycle');
const metapak = require('./metapak');
const YError = require('yerror');

describe('metapak', () => {
  const DEPENDENCIES = [
    'ENV',
    'PROJECT_DIR',
    'fs',
    'log',
    'exit',
    'buildPackageConf',
    'buildPackageAssets',
    'buildPackageGitHooks',
  ];
  let $;
  let buildPackageConfStub;
  let buildPackageAssetsStub;
  let buildPackageGitHooksStub;

  beforeEach(() => {
    $ = new Knifecycle();
    $.register(constant('ENV', {}));
    $.register(constant('log', sinon.stub()));
    $.register(constant('exit', sinon.stub()));
    $.register(constant('PROJECT_DIR', 'project/dir'));
    buildPackageConfStub = sinon.stub();
    $.register(constant('buildPackageConf', buildPackageConfStub));
    buildPackageAssetsStub = sinon.stub();
    $.register(constant('buildPackageAssets', buildPackageAssetsStub));
    buildPackageGitHooksStub = sinon.stub();
    $.register(constant('buildPackageGitHooks', buildPackageGitHooksStub));
  });

  beforeEach(() => {
    buildPackageConfStub.returns(Promise.resolve());
    buildPackageAssetsStub.returns(Promise.resolve());
    buildPackageGitHooksStub.returns(Promise.resolve());
  });

  it('should silently fail with no metapak module', done => {
    $.register(
      constant('fs', {
        readFileAsync: sinon.stub().returns(Promise.resolve('{}')),
      })
    );

    $.run(DEPENDENCIES)
      .then(services => {
        const { exit, log, fs } = services;

        return metapak(services).then(() => {
          assert.deepEqual(fs.readFileAsync.args, [
            ['project/dir/package.json', 'utf-8'],
          ]);
          assert.deepEqual(log.args, [['debug', 'No metapak modules found.']]);
          assert.deepEqual(exit.args, [[0]]);
        });
      })
      .then(done)
      .catch(done);
  });

  it('should fail with a bad package.json path', done => {
    $.register(
      constant('fs', {
        readFileAsync: sinon
          .stub()
          .returns(Promise.reject(new YError('E_AOUCH'))),
      })
    );

    $.run(DEPENDENCIES)
      .then(services => {
        const { exit, log, fs } = services;

        return metapak(services).then(() => {
          assert.deepEqual(fs.readFileAsync.args, [
            ['project/dir/package.json', 'utf-8'],
          ]);
          assert.deepEqual(log.args.slice(0, -1), [
            [
              'error',
              '💀 - Could not run metapak script correctly:',
              'E_PACKAGE_NOT_FOUND',
              ['project/dir/package.json'],
            ],
            ['info', '💊 - Debug by running again with "DEBUG=metapak" env.'],
          ]);
          assert.deepEqual(exit.args, [[1]]);
        });
      })
      .then(done)
      .catch(done);
  });

  it('should fail with a malformed package.json', done => {
    $.register(
      constant('fs', {
        readFileAsync: sinon.stub().returns(Promise.resolve('{""}')),
      })
    );

    $.run(DEPENDENCIES)
      .then(services => {
        const { exit, log, fs } = services;

        return metapak(services).then(() => {
          assert.deepEqual(fs.readFileAsync.args, [
            ['project/dir/package.json', 'utf-8'],
          ]);
          assert.deepEqual(log.args.slice(0, -1), [
            [
              'error',
              '💀 - Could not run metapak script correctly:',
              'E_MALFORMED_PACKAGE',
              [
                'project/dir/package.json',
                'Unexpected token } in JSON at position 3',
              ],
            ],
            ['info', '💊 - Debug by running again with "DEBUG=metapak" env.'],
          ]);
          assert.deepEqual(exit.args, [[1]]);
        });
      })
      .then(done)
      .catch(done);
  });

  it('should fail with a bad sequence type', done => {
    $.register(
      constant('fs', {
        readFileAsync: sinon.stub().returns(
          Promise.resolve(
            JSON.stringify({
              metapak: {
                sequence: 'unexisting_module',
              },
            })
          )
        ),
      })
    );

    $.run(DEPENDENCIES)
      .then(services => {
        const { exit, log, fs } = services;

        return metapak(services).then(() => {
          assert.deepEqual(fs.readFileAsync.args, [
            ['project/dir/package.json', 'utf-8'],
          ]);
          assert.deepEqual(log.args.slice(0, -1), [
            [
              'error',
              '💀 - Could not run metapak script correctly:',
              'E_BAD_SEQUENCE_TYPE',
              ['string', 'unexisting_module'],
            ],
            ['info', '💊 - Debug by running again with "DEBUG=metapak" env.'],
          ]);
          assert.deepEqual(exit.args, [[1]]);
        });
      })
      .then(done)
      .catch(done);
  });

  it('should fail with a bad sequence item', done => {
    $.register(
      constant('fs', {
        readFileAsync: sinon.stub().returns(
          Promise.resolve(
            JSON.stringify({
              metapak: {
                sequence: ['unexisting_module'],
              },
            })
          )
        ),
      })
    );

    $.run(DEPENDENCIES)
      .then(services => {
        const { exit, log, fs } = services;

        return metapak(services).then(() => {
          assert.deepEqual(fs.readFileAsync.args, [
            ['project/dir/package.json', 'utf-8'],
          ]);
          assert.deepEqual(log.args.slice(0, -1), [
            [
              'error',
              '💀 - Could not run metapak script correctly:',
              'E_BAD_SEQUENCE_ITEM',
              ['unexisting_module'],
            ],
            ['info', '💊 - Debug by running again with "DEBUG=metapak" env.'],
          ]);
          assert.deepEqual(exit.args, [[1]]);
        });
      })
      .then(done)
      .catch(done);
  });

  it('should fail with non-idempotent package transformer ', done => {
    const readFileStub = sinon.stub();
    const readdirStub = sinon.stub();
    const packageConf = {
      devDependencies: {
        'metapak-http-service': '1.0.0',
      },
    };

    readFileStub
      .onFirstCall()
      .returns(Promise.resolve(JSON.stringify(packageConf)));
    readdirStub.returns(Promise.resolve(['_common', 'private']));
    readFileStub.onSecondCall().returns(
      Promise.resolve(
        JSON.stringify({
          dependencies: {
            siso: '1.0.0',
            'strict-qs': '1.0.0',
          },
        })
      )
    );
    readFileStub.onThirdCall().returns(
      Promise.resolve(
        JSON.stringify({
          private: true,
        })
      )
    );

    $.register(
      constant('fs', {
        readFileAsync: readFileStub,
        readdirAsync: readdirStub,
      })
    );

    $.run(DEPENDENCIES)
      .then(services => {
        const {
          exit,
          log,
          fs,
          buildPackageConf,
          buildPackageAssets,
          buildPackageGitHooks,
        } = services;

        buildPackageConf.returns(Promise.resolve(true));

        return metapak(services).then(() => {
          assert.deepEqual(fs.readFileAsync.args, [
            ['project/dir/package.json', 'utf-8'],
          ]);
          assert.deepEqual(log.args.slice(0, -1), [
            [
              'debug',
              'Resolved the metapak modules sequence:',
              ['metapak-http-service'],
            ],
            ['debug', 'Found configs for "metapak-http-service":', ['_common']],
            [
              'error',
              '💀 - Could not run metapak script correctly:',
              'E_MAX_ITERATIONS',
              [15, 15],
            ],
            ['info', '💊 - Debug by running again with "DEBUG=metapak" env.'],
          ]);
          assert.deepEqual(exit.args, [[1]]);
          assert.deepEqual(buildPackageConf.args.length, 16);
          assert.deepEqual(buildPackageAssets.args, []);
          assert.deepEqual(buildPackageGitHooks.args, []);
        });
      })
      .then(done)
      .catch(done);
  });

  it('should work with one module and several configs', done => {
    const readFileStub = sinon.stub();
    const readdirStub = sinon.stub();
    const packageConf = {
      devDependencies: {
        'metapak-http-service': '1.0.0',
      },
    };

    readFileStub
      .onFirstCall()
      .returns(Promise.resolve(JSON.stringify(packageConf)));
    readdirStub.returns(Promise.resolve(['_common', 'private']));
    readFileStub.onSecondCall().returns(
      Promise.resolve(
        JSON.stringify({
          dependencies: {
            siso: '1.0.0',
            'strict-qs': '1.0.0',
          },
        })
      )
    );
    readFileStub.onThirdCall().returns(
      Promise.resolve(
        JSON.stringify({
          private: true,
        })
      )
    );

    $.register(
      constant('fs', {
        readFileAsync: readFileStub,
        readdirAsync: readdirStub,
      })
    );

    $.run(DEPENDENCIES)
      .then(services => {
        const {
          exit,
          log,
          fs,
          buildPackageConf,
          buildPackageAssets,
          buildPackageGitHooks,
        } = services;

        return metapak(services).then(() => {
          assert.deepEqual(fs.readFileAsync.args, [
            ['project/dir/package.json', 'utf-8'],
          ]);
          assert.deepEqual(log.args, [
            [
              'debug',
              'Resolved the metapak modules sequence:',
              ['metapak-http-service'],
            ],
            ['debug', 'Found configs for "metapak-http-service":', ['_common']],
          ]);
          assert.deepEqual(exit.args, [[0]]);
          assert.deepEqual(buildPackageConf.args, [
            [
              packageConf,
              ['metapak-http-service'],
              {
                'metapak-http-service': ['_common'],
              },
            ],
          ]);
          assert.deepEqual(buildPackageAssets.args, buildPackageConf.args);
          assert.deepEqual(buildPackageGitHooks.args, buildPackageConf.args);
        });
      })
      .then(done)
      .catch(done);
  });

  it('should work with one module and one config', done => {
    const readFileStub = sinon.stub();
    const readdirStub = sinon.stub();
    const packageConf = {
      devDependencies: {
        'metapak-http-service': '1.0.0',
      },
      metapak: {
        configs: ['private'],
      },
    };

    readFileStub
      .onFirstCall()
      .returns(Promise.resolve(JSON.stringify(packageConf)));
    readdirStub.returns(Promise.resolve(['_common', 'private']));
    readFileStub.onSecondCall().returns(
      Promise.resolve(
        JSON.stringify({
          dependencies: {
            siso: '1.0.0',
            'strict-qs': '1.0.0',
          },
        })
      )
    );
    readFileStub.onThirdCall().returns(
      Promise.resolve(
        JSON.stringify({
          private: true,
        })
      )
    );

    $.register(
      constant('fs', {
        readFileAsync: readFileStub,
        readdirAsync: readdirStub,
      })
    );

    $.run(DEPENDENCIES)
      .then(services => {
        const {
          exit,
          log,
          fs,
          buildPackageConf,
          buildPackageAssets,
          buildPackageGitHooks,
        } = services;

        return metapak(services).then(() => {
          assert.deepEqual(fs.readFileAsync.args, [
            ['project/dir/package.json', 'utf-8'],
          ]);
          assert.deepEqual(log.args, [
            [
              'debug',
              'Resolved the metapak modules sequence:',
              ['metapak-http-service'],
            ],
            [
              'debug',
              'Found configs for "metapak-http-service":',
              ['_common', 'private'],
            ],
          ]);
          assert.deepEqual(exit.args, [[0]]);
          assert.deepEqual(buildPackageConf.args, [
            [
              packageConf,
              ['metapak-http-service'],
              {
                'metapak-http-service': ['_common', 'private'],
              },
            ],
          ]);
          assert.deepEqual(buildPackageAssets.args, buildPackageConf.args);
          assert.deepEqual(buildPackageGitHooks.args, buildPackageConf.args);
        });
      })
      .then(done)
      .catch(done);
  });

  it('should work with one module and several overriden configs', done => {
    const readFileStub = sinon.stub();
    const readdirStub = sinon.stub();
    const packageConf = {
      devDependencies: {
        'metapak-http-service': '1.0.0',
      },
      metapak: {
        configs: ['private', 'bisous'],
      },
    };

    readFileStub
      .onFirstCall()
      .returns(Promise.resolve(JSON.stringify(packageConf)));
    readdirStub.returns(
      Promise.resolve(['_common', 'bisous', 'private', 'coucou'])
    );
    readFileStub.onSecondCall().returns(
      Promise.resolve(
        JSON.stringify({
          dependencies: {
            siso: '1.0.0',
            'strict-qs': '1.0.0',
          },
        })
      )
    );
    readFileStub.onThirdCall().returns(
      Promise.resolve(
        JSON.stringify({
          private: true,
        })
      )
    );

    $.register(
      constant('fs', {
        readFileAsync: readFileStub,
        readdirAsync: readdirStub,
      })
    );

    $.run(DEPENDENCIES)
      .then(services => {
        const {
          exit,
          log,
          fs,
          buildPackageConf,
          buildPackageAssets,
          buildPackageGitHooks,
        } = services;

        return metapak(services).then(() => {
          assert.deepEqual(fs.readFileAsync.args, [
            ['project/dir/package.json', 'utf-8'],
          ]);
          assert.deepEqual(log.args, [
            [
              'debug',
              'Resolved the metapak modules sequence:',
              ['metapak-http-service'],
            ],
            [
              'debug',
              'Found configs for "metapak-http-service":',
              ['_common', 'private', 'bisous'],
            ],
          ]);
          assert.deepEqual(exit.args, [[0]]);
          assert.deepEqual(buildPackageConf.args, [
            [
              packageConf,
              ['metapak-http-service'],
              {
                'metapak-http-service': ['_common', 'private', 'bisous'],
              },
            ],
          ]);
          assert.deepEqual(buildPackageAssets.args, buildPackageConf.args);
          assert.deepEqual(buildPackageGitHooks.args, buildPackageConf.args);
        });
      })
      .then(done)
      .catch(done);
  });
});
