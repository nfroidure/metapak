'use strict';

const assert = require('assert');
const sinon = require('sinon');
const { default: Knifecycle, constant } = require('knifecycle');
const initMetapak = require('./metapak');
const YError = require('yerror').default;

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
    'metapak',
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
    $.register(
      constant(
        'resolveModule',
        (moduleName) => `project/dir/node_modules/${moduleName}`
      )
    );
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

  it('should silently fail with no metapak module', async () => {
    $.register(
      constant('fs', {
        readFileAsync: sinon.stub().returns(Promise.resolve('{}')),
      })
    );
    $.register(initMetapak);

    const { metapak, exit, log, fs } = await $.run(DEPENDENCIES);

    await metapak();

    assert.deepEqual(fs.readFileAsync.args, [
      ['project/dir/package.json', 'utf-8'],
    ]);
    assert.deepEqual(log.args, [['debug', 'No metapak modules found.']]);
    assert.deepEqual(exit.args, [[0]]);
  });

  it('should fail with a bad package.json path', async () => {
    $.register(
      constant('fs', {
        readFileAsync: sinon
          .stub()
          .returns(Promise.reject(new YError('E_AOUCH'))),
      })
    );
    $.register(initMetapak);

    const { metapak, exit, log, fs } = await $.run(DEPENDENCIES);

    await metapak();
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

  it('should fail with a malformed package.json', async () => {
    $.register(
      constant('fs', {
        readFileAsync: sinon.stub().returns(Promise.resolve('{""}')),
      })
    );
    $.register(initMetapak);

    const { metapak, exit, log, fs } = await $.run(DEPENDENCIES);

    await metapak();

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

  it('should fail with a bad sequence type', async () => {
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
    $.register(initMetapak);

    const { metapak, exit, log, fs } = await $.run(DEPENDENCIES);

    await metapak();
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

  it('should fail with a bad sequence item', async () => {
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
    $.register(initMetapak);

    const { metapak, exit, log, fs } = await $.run(DEPENDENCIES);

    await metapak();
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

  it('should fail with non-idempotent package transformer ', async () => {
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
    $.register(initMetapak);

    const {
      metapak,
      exit,
      log,
      fs,
      buildPackageConf,
      buildPackageAssets,
      buildPackageGitHooks,
    } = await $.run(DEPENDENCIES);

    buildPackageConf.returns(Promise.resolve(true));

    await metapak();

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

  it('should work with one module and several configs', async () => {
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
    $.register(initMetapak);

    const {
      metapak,
      exit,
      log,
      fs,
      buildPackageConf,
      buildPackageAssets,
      buildPackageGitHooks,
    } = await $.run(DEPENDENCIES);

    await metapak();
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

  it('should work with one module and one config', async () => {
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
    $.register(initMetapak);

    const {
      metapak,
      exit,
      log,
      fs,
      buildPackageConf,
      buildPackageAssets,
      buildPackageGitHooks,
    } = await $.run(DEPENDENCIES);

    await metapak();
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

  it('should work with one module and several overriden configs', async () => {
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
    $.register(initMetapak);

    const {
      metapak,
      exit,
      log,
      fs,
      buildPackageConf,
      buildPackageAssets,
      buildPackageGitHooks,
    } = await $.run(DEPENDENCIES);

    await metapak();

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
});
