'use strict';

const assert = require('assert');
const sinon = require('sinon');
const { default: Knifecycle, constant } = require('knifecycle');
const initBuildPackageAssets = require('./assets');

function filterLogs(e) {
  return 'stack' !== e[0];
}

describe('buildPackageAssets', () => {
  const DEPENDENCIES = ['buildPackageAssets', 'fs', 'log', 'require'];
  let $;
  let readFileStub;
  let writeFileStub;
  let unlinkStub;
  let requireStub;
  let globStub;
  let mkdirpStub;

  beforeEach(() => {
    readFileStub = sinon.stub();
    writeFileStub = sinon.stub();
    unlinkStub = sinon.stub();
    requireStub = sinon.stub();
    globStub = sinon.stub();
    mkdirpStub = sinon.stub();

    $ = new Knifecycle();
    $.register(constant('ENV', {}));
    $.register(constant('log', sinon.stub()));
    $.register(constant('glob', globStub));
    $.register(constant('mkdirp', mkdirpStub));
    $.register(constant('PROJECT_DIR', 'project/dir'));
    $.register(
      constant('fs', {
        readFileAsync: readFileStub,
        writeFileAsync: writeFileStub,
        unlinkAsync: unlinkStub,
      })
    );
    $.register(constant('require', requireStub));
    $.register(
      constant(
        'resolveModule',
        (moduleName) => `project/dir/node_modules/${moduleName}`
      )
    );
    $.register(initBuildPackageAssets);
  });

  it('should work when data changed', (done) => {
    const packageConf = {};

    requireStub.returns((file) => {
      file.data = '{\n  "private": false\n}';
      return file;
    });
    readFileStub.onFirstCall().returns(Promise.resolve('{\n  "test": true\n}'));
    readFileStub
      .onSecondCall()
      .returns(Promise.resolve('{\n  "private": true\n}'));
    writeFileStub.returns(Promise.resolve());
    unlinkStub.returns(Promise.resolve());
    globStub.returns(Promise.resolve(['lol']));
    mkdirpStub.returns(Promise.resolve());

    $.run(DEPENDENCIES)
      .then(({ require, log, buildPackageAssets }) =>
        buildPackageAssets(packageConf, ['metapak-http-server'], {
          'metapak-http-server': ['_common'],
        }).then((result) => {
          assert.deepEqual(globStub.args, [
            [
              '**/*',
              {
                cwd:
                  'project/dir/node_modules/metapak-http-server/src/_common/assets',
                dot: true,
                nodir: true,
              },
            ],
          ]);
          assert.deepEqual(require.args, [
            [
              'project/dir/node_modules/metapak-http-server/src/_common/assets.js',
            ],
          ]);
          assert.deepEqual(readFileStub.args, [
            [
              'project/dir/node_modules/metapak-http-server/src/_common/assets/lol',
              'utf-8',
            ],
            ['project/dir/lol', 'utf-8'],
          ]);
          assert.deepEqual(mkdirpStub.args, [], 'No mkdirp performed.');
          assert.deepEqual(writeFileStub.args, [
            ['project/dir/lol', '{\n  "private": false\n}', 'utf-8'],
          ]);
          assert.deepEqual(unlinkStub.args, [], 'Deletes nothing.');
          assert.deepEqual(log.args.filter(filterLogs), [
            [
              'debug',
              'Processing asset:',
              'project/dir/node_modules/metapak-http-server/src/_common/assets/lol',
            ],
            ['debug', 'Saving asset:', 'project/dir/lol'],
          ]);
          assert.equal(result, true, 'Indicates that data changed');
        })
      )
      .then(done)
      .catch(done);
  });

  it('should rename _dot_ prefixed files', (done) => {
    const packageConf = {};

    requireStub.returns((file) => {
      file.data = '{\n  "private": false\n}';
      return file;
    });
    readFileStub.onFirstCall().returns(Promise.resolve('{\n  "test": true\n}'));
    readFileStub
      .onSecondCall()
      .returns(Promise.resolve('{\n  "private": true\n}'));
    writeFileStub.returns(Promise.resolve());
    unlinkStub.returns(Promise.resolve());
    globStub.returns(Promise.resolve(['_dot_gitignore']));
    mkdirpStub.returns(Promise.resolve());

    $.run(DEPENDENCIES)
      .then(({ require, log, buildPackageAssets }) =>
        buildPackageAssets(packageConf, ['metapak-http-server'], {
          'metapak-http-server': ['_common'],
        }).then((result) => {
          assert.deepEqual(globStub.args, [
            [
              '**/*',
              {
                cwd:
                  'project/dir/node_modules/metapak-http-server/src/_common/assets',
                dot: true,
                nodir: true,
              },
            ],
          ]);
          assert.deepEqual(require.args, [
            [
              'project/dir/node_modules/metapak-http-server/src/_common/assets.js',
            ],
          ]);
          assert.deepEqual(readFileStub.args, [
            [
              'project/dir/node_modules/metapak-http-server/src/_common/assets/_dot_gitignore',
              'utf-8',
            ],
            ['project/dir/.gitignore', 'utf-8'],
          ]);
          assert.deepEqual(mkdirpStub.args, [], 'No mkdirp performed.');
          assert.deepEqual(writeFileStub.args, [
            ['project/dir/.gitignore', '{\n  "private": false\n}', 'utf-8'],
          ]);
          assert.deepEqual(unlinkStub.args, [], 'Deletes nothing.');
          assert.deepEqual(log.args.filter(filterLogs), [
            [
              'debug',
              'Processing asset:',
              'project/dir/node_modules/metapak-http-server/src/_common/assets/_dot_gitignore',
            ],
            ['debug', 'Saving asset:', 'project/dir/.gitignore'],
          ]);
          assert.equal(result, true, 'Indicates that data changed');
        })
      )
      .then(done)
      .catch(done);
  });

  it('should warn on using .gitignore files', (done) => {
    const packageConf = {};

    requireStub.returns((file) => {
      file.data = '{\n  "private": false\n}';
      return file;
    });
    readFileStub.onFirstCall().returns(Promise.resolve('{\n  "test": true\n}'));
    readFileStub
      .onSecondCall()
      .returns(Promise.resolve('{\n  "private": true\n}'));
    writeFileStub.returns(Promise.resolve());
    unlinkStub.returns(Promise.resolve());
    globStub.returns(Promise.resolve(['.gitignore']));
    mkdirpStub.returns(Promise.resolve());

    $.run(DEPENDENCIES)
      .then(({ require, log, buildPackageAssets }) =>
        buildPackageAssets(packageConf, ['metapak-http-server'], {
          'metapak-http-server': ['_common'],
        }).then((result) => {
          assert.deepEqual(globStub.args, [
            [
              '**/*',
              {
                cwd:
                  'project/dir/node_modules/metapak-http-server/src/_common/assets',
                dot: true,
                nodir: true,
              },
            ],
          ]);
          assert.deepEqual(require.args, [
            [
              'project/dir/node_modules/metapak-http-server/src/_common/assets.js',
            ],
          ]);
          assert.deepEqual(readFileStub.args, [
            [
              'project/dir/node_modules/metapak-http-server/src/_common/assets/.gitignore',
              'utf-8',
            ],
            ['project/dir/.gitignore', 'utf-8'],
          ]);
          assert.deepEqual(mkdirpStub.args, [], 'No mkdirp performed.');
          assert.deepEqual(writeFileStub.args, [
            ['project/dir/.gitignore', '{\n  "private": false\n}', 'utf-8'],
          ]);
          assert.deepEqual(unlinkStub.args, [], 'Deletes nothing.');
          assert.deepEqual(log.args.filter(filterLogs), [
            [
              'warning',
              '`.gitignore` assets may not work, use `_dot_` instead of a raw `.`',
            ],
            [
              'warning',
              'in your `assets` folder, metapak will care to rename them',
            ],
            [
              'warning',
              'correctly. See https://github.com/npm/npm/issues/15660',
            ],
            [
              'debug',
              'Processing asset:',
              'project/dir/node_modules/metapak-http-server/src/_common/assets/.gitignore',
            ],
            ['debug', 'Saving asset:', 'project/dir/.gitignore'],
          ]);
          assert.equal(result, true, 'Indicates that data changed');
        })
      )
      .then(done)
      .catch(done);
  });

  it('should work whith several transformers', (done) => {
    const packageConf = {};

    requireStub.onFirstCall().returns((file) => {
      file.data += 'node_modules\n';
      return file;
    });
    requireStub.onSecondCall().returns((file) => {
      file.data += 'coverage\n';
      return file;
    });
    readFileStub.onFirstCall().returns(Promise.resolve('.git\n'));
    readFileStub.onSecondCall().returns(Promise.resolve('.git\n.lol\n'));
    writeFileStub.returns(Promise.resolve());
    unlinkStub.returns(Promise.resolve());
    globStub.onFirstCall().returns(Promise.resolve(['_dot_gitignore']));
    globStub.onSecondCall().returns(Promise.resolve([]));
    mkdirpStub.returns(Promise.resolve());

    $.run(DEPENDENCIES)
      .then(({ require, log, buildPackageAssets }) =>
        buildPackageAssets(
          packageConf,
          ['metapak-module1', 'metapak-module2'],
          {
            'metapak-module1': ['_common'],
            'metapak-module2': ['_common'],
          }
        ).then((result) => {
          assert.deepEqual(globStub.args, [
            [
              '**/*',
              {
                cwd:
                  'project/dir/node_modules/metapak-module1/src/_common/assets',
                dot: true,
                nodir: true,
              },
            ],
            [
              '**/*',
              {
                cwd:
                  'project/dir/node_modules/metapak-module2/src/_common/assets',
                dot: true,
                nodir: true,
              },
            ],
          ]);
          assert.deepEqual(require.args, [
            ['project/dir/node_modules/metapak-module1/src/_common/assets.js'],
            ['project/dir/node_modules/metapak-module2/src/_common/assets.js'],
          ]);
          assert.deepEqual(readFileStub.args, [
            [
              'project/dir/node_modules/metapak-module1/src/_common/assets/_dot_gitignore',
              'utf-8',
            ],
            ['project/dir/.gitignore', 'utf-8'],
          ]);
          assert.deepEqual(mkdirpStub.args, [], 'No mkdirp performed.');
          assert.deepEqual(writeFileStub.args, [
            [
              'project/dir/.gitignore',
              '.git\nnode_modules\ncoverage\n',
              'utf-8',
            ],
          ]);
          assert.deepEqual(unlinkStub.args, [], 'Deletes nothing.');
          assert.deepEqual(log.args.filter(filterLogs), [
            [
              'debug',
              'Processing asset:',
              'project/dir/node_modules/metapak-module1/src/_common/assets/_dot_gitignore',
            ],
            ['debug', 'Saving asset:', 'project/dir/.gitignore'],
          ]);
          assert.equal(result, true, 'Indicates that data changed');
        })
      )
      .then(done)
      .catch(done);
  });

  it('should work whith directories', (done) => {
    const packageConf = {};

    requireStub.returns((file) => {
      file.data = '{\n  "private": false\n}';
      return file;
    });
    readFileStub.onFirstCall().returns(Promise.resolve('{\n  "test": true\n}'));
    readFileStub
      .onSecondCall()
      .returns(Promise.resolve('{\n  "private": true\n}'));
    writeFileStub.returns(Promise.resolve());
    unlinkStub.returns(Promise.resolve());
    globStub.returns(Promise.resolve(['lol/wadup']));
    mkdirpStub.returns(Promise.resolve());

    $.run(DEPENDENCIES)
      .then(({ require, log, buildPackageAssets }) =>
        buildPackageAssets(packageConf, ['metapak-http-server'], {
          'metapak-http-server': ['_common'],
        }).then((result) => {
          assert.deepEqual(globStub.args, [
            [
              '**/*',
              {
                cwd:
                  'project/dir/node_modules/metapak-http-server/src/_common/assets',
                dot: true,
                nodir: true,
              },
            ],
          ]);
          assert.deepEqual(require.args, [
            [
              'project/dir/node_modules/metapak-http-server/src/_common/assets.js',
            ],
          ]);
          assert.deepEqual(readFileStub.args, [
            [
              'project/dir/node_modules/metapak-http-server/src/_common/assets/lol/wadup',
              'utf-8',
            ],
            ['project/dir/lol/wadup', 'utf-8'],
          ]);
          assert.deepEqual(
            mkdirpStub.args,
            [['project/dir/lol']],
            'mkdirp performed.'
          );
          assert.deepEqual(writeFileStub.args, [
            ['project/dir/lol/wadup', '{\n  "private": false\n}', 'utf-8'],
          ]);
          assert.deepEqual(unlinkStub.args, [], 'Deletes nothing.');
          assert.deepEqual(log.args.filter(filterLogs), [
            [
              'debug',
              'Processing asset:',
              'project/dir/node_modules/metapak-http-server/src/_common/assets/lol/wadup',
            ],
            ['debug', 'Saving asset:', 'project/dir/lol/wadup'],
          ]);
          assert.equal(result, true, 'Indicates that data changed');
        })
      )
      .then(done)
      .catch(done);
  });

  it('should allow to rename assets with async transformers', (done) => {
    const packageConf = {};

    requireStub.returns((file) => {
      file.name = 'notlol';
      file.data = '{\n  "private": false\n}';
      return Promise.resolve(file);
    });
    readFileStub.onFirstCall().returns(Promise.resolve('{\n  "test": true\n}'));
    readFileStub
      .onSecondCall()
      .returns(Promise.resolve('{\n  "private": true\n}'));
    writeFileStub.returns(Promise.resolve());
    unlinkStub.returns(Promise.resolve());
    globStub.returns(Promise.resolve(['lol']));
    mkdirpStub.returns(Promise.resolve());

    $.run(DEPENDENCIES)
      .then(({ require, log, buildPackageAssets }) =>
        buildPackageAssets(packageConf, ['metapak-http-server'], {
          'metapak-http-server': ['_common'],
        }).then((result) => {
          assert.deepEqual(globStub.args, [
            [
              '**/*',
              {
                cwd:
                  'project/dir/node_modules/metapak-http-server/src/_common/assets',
                dot: true,
                nodir: true,
              },
            ],
          ]);
          assert.deepEqual(require.args, [
            [
              'project/dir/node_modules/metapak-http-server/src/_common/assets.js',
            ],
          ]);
          assert.deepEqual(readFileStub.args, [
            [
              'project/dir/node_modules/metapak-http-server/src/_common/assets/lol',
              'utf-8',
            ],
            ['project/dir/notlol', 'utf-8'],
          ]);
          assert.deepEqual(mkdirpStub.args, [], 'No mkdirp performed.');
          assert.deepEqual(writeFileStub.args, [
            ['project/dir/notlol', '{\n  "private": false\n}', 'utf-8'],
          ]);
          assert.deepEqual(unlinkStub.args, [], 'Deletes nothing.');
          assert.deepEqual(log.args.filter(filterLogs), [
            [
              'debug',
              'Processing asset:',
              'project/dir/node_modules/metapak-http-server/src/_common/assets/lol',
            ],
            ['debug', 'Saving asset:', 'project/dir/notlol'],
          ]);
          assert.equal(result, true, 'Indicates that data changed');
        })
      )
      .then(done)
      .catch(done);
  });

  it('should work when data did not change', (done) => {
    const packageConf = {};

    requireStub.returns((file) => {
      file.data = '{\n  "private": true\n}';
      return file;
    });
    readFileStub.onFirstCall().returns(Promise.resolve('{\n  "test": true\n}'));
    readFileStub
      .onSecondCall()
      .returns(Promise.resolve('{\n  "private": true\n}'));
    writeFileStub.returns(Promise.resolve());
    unlinkStub.returns(Promise.resolve());
    globStub.returns(Promise.resolve(['lol']));
    mkdirpStub.returns(Promise.resolve());

    $.run(DEPENDENCIES)
      .then(({ require, log, buildPackageAssets }) =>
        buildPackageAssets(packageConf, ['metapak-http-server'], {
          'metapak-http-server': ['_common'],
        }).then((result) => {
          assert.deepEqual(globStub.args, [
            [
              '**/*',
              {
                cwd:
                  'project/dir/node_modules/metapak-http-server/src/_common/assets',
                dot: true,
                nodir: true,
              },
            ],
          ]);
          assert.deepEqual(require.args, [
            [
              'project/dir/node_modules/metapak-http-server/src/_common/assets.js',
            ],
          ]);
          assert.deepEqual(readFileStub.args, [
            [
              'project/dir/node_modules/metapak-http-server/src/_common/assets/lol',
              'utf-8',
            ],
            ['project/dir/lol', 'utf-8'],
          ]);
          assert.deepEqual(mkdirpStub.args, [], 'No mkdirp performed.');
          assert.deepEqual(writeFileStub.args, [], 'Writes nothing.');
          assert.deepEqual(unlinkStub.args, [], 'Deletes nothing.');
          assert.deepEqual(log.args, [
            [
              'debug',
              'Processing asset:',
              'project/dir/node_modules/metapak-http-server/src/_common/assets/lol',
            ],
          ]);
          assert.equal(result, false, 'Indicates that data did not change');
        })
      )
      .then(done)
      .catch(done);
  });

  it('should delete when data is empty', (done) => {
    const packageConf = {};

    requireStub.returns((file) => {
      file.data = '';
      return file;
    });
    readFileStub.onFirstCall().returns(Promise.resolve('{\n  "test": true\n}'));
    readFileStub
      .onSecondCall()
      .returns(Promise.resolve('{\n  "private": true\n}'));
    writeFileStub.returns(Promise.resolve());
    unlinkStub.returns(Promise.resolve());
    globStub.returns(Promise.resolve(['lol']));
    mkdirpStub.returns(Promise.resolve());

    $.run(DEPENDENCIES)
      .then(({ require, log, buildPackageAssets }) =>
        buildPackageAssets(packageConf, ['metapak-http-server'], {
          'metapak-http-server': ['_common'],
        }).then((result) => {
          assert.deepEqual(globStub.args, [
            [
              '**/*',
              {
                cwd:
                  'project/dir/node_modules/metapak-http-server/src/_common/assets',
                dot: true,
                nodir: true,
              },
            ],
          ]);
          assert.deepEqual(require.args, [
            [
              'project/dir/node_modules/metapak-http-server/src/_common/assets.js',
            ],
          ]);
          assert.deepEqual(readFileStub.args, [
            [
              'project/dir/node_modules/metapak-http-server/src/_common/assets/lol',
              'utf-8',
            ],
            ['project/dir/lol', 'utf-8'],
          ]);
          assert.deepEqual(mkdirpStub.args, [], 'No mkdirp performed.');
          assert.deepEqual(writeFileStub.args, [], 'Writes nothing.');
          assert.deepEqual(
            unlinkStub.args,
            [['project/dir/lol']],
            'Deletes the resource.'
          );
          assert.deepEqual(log.args, [
            [
              'debug',
              'Processing asset:',
              'project/dir/node_modules/metapak-http-server/src/_common/assets/lol',
            ],
            ['debug', 'Deleting asset:', 'project/dir/lol'],
          ]);
          assert.equal(result, true, 'Indicates that changed');
        })
      )
      .then(done)
      .catch(done);
  });

  it('should not delete when data is empty and file is already  deleted', (done) => {
    const packageConf = {};

    requireStub.returns((file) => {
      file.data = '';
      return file;
    });
    readFileStub.onFirstCall().returns(Promise.resolve('{\n  "test": true\n}'));
    readFileStub
      .onSecondCall()
      .returns(Promise.reject(new Error('E_NOT_FOUND')));
    writeFileStub.returns(Promise.resolve());
    unlinkStub.returns(Promise.resolve());
    globStub.returns(Promise.resolve(['lol']));
    mkdirpStub.returns(Promise.resolve());

    $.run(DEPENDENCIES)
      .then(({ require, log, buildPackageAssets }) =>
        buildPackageAssets(packageConf, ['metapak-http-server'], {
          'metapak-http-server': ['_common'],
        }).then((result) => {
          assert.deepEqual(globStub.args, [
            [
              '**/*',
              {
                cwd:
                  'project/dir/node_modules/metapak-http-server/src/_common/assets',
                dot: true,
                nodir: true,
              },
            ],
          ]);
          assert.deepEqual(require.args, [
            [
              'project/dir/node_modules/metapak-http-server/src/_common/assets.js',
            ],
          ]);
          assert.deepEqual(readFileStub.args, [
            [
              'project/dir/node_modules/metapak-http-server/src/_common/assets/lol',
              'utf-8',
            ],
            ['project/dir/lol', 'utf-8'],
          ]);
          assert.deepEqual(mkdirpStub.args, [], 'No mkdirp performed.');
          assert.deepEqual(writeFileStub.args, [], 'Writes nothing.');
          assert.deepEqual(
            unlinkStub.args,
            [],
            'Does not delete the resource.'
          );
          assert.deepEqual(log.args.filter(filterLogs), [
            [
              'debug',
              'Processing asset:',
              'project/dir/node_modules/metapak-http-server/src/_common/assets/lol',
            ],
            [
              'debug',
              'Asset not found:',
              'project/dir/node_modules/metapak-http-server/src/_common/assets/lol',
            ],
          ]);
          assert.equal(result, false, 'Indicates that nothing changed');
        })
      )
      .then(done)
      .catch(done);
  });
});
