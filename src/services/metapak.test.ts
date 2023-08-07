import { describe, beforeEach, test, jest, expect } from '@jest/globals';
import { Knifecycle, constant } from 'knifecycle';
import initMetapak from './metapak.js';
import { YError } from 'yerror';
import type { MetapakService } from './metapak.js';
import type { LogService, ResolveService } from 'common-services';
import type { BuildPackageConfService } from './packageConf.js';
import type { BuildPackageAssetsService } from './assets.js';
import type { BuildPackageGitHooksService } from './gitHooks.js';
import type { MetapakPackageJson } from '../libs/utils.js';
import type { FSService } from './fs.js';

describe('metapak', () => {
  const buildPackageConf = jest.fn<BuildPackageConfService>();
  const buildPackageAssets = jest.fn<BuildPackageAssetsService>();
  const buildPackageGitHooks = jest.fn<BuildPackageGitHooksService>();
  const resolve = jest.fn<ResolveService>(
    (path) => `/home/whoami/project/dir/node_modules/${path}.js`,
  );
  const accessAsync = jest.fn<FSService['accessAsync']>();
  const readFileAsync = jest.fn<FSService['readFileAsync']>();
  const readdirAsync = jest.fn<FSService['readdirAsync']>();
  const log = jest.fn<LogService>();
  const exit = jest.fn<typeof process.exit>();
  let $: Knifecycle;

  beforeEach(() => {
    log.mockReset();
    exit.mockReset();
    accessAsync.mockReset();
    readFileAsync.mockReset();
    readdirAsync.mockReset();
    resolve.mockClear();
    buildPackageConf.mockReset();
    buildPackageAssets.mockReset();
    buildPackageGitHooks.mockReset();

    $ = new Knifecycle();
    $.register(constant('ENV', {}));
    $.register(constant('log', log));
    $.register(constant('exit', exit));
    $.register(constant('PROJECT_DIR', 'project/dir'));
    $.register(constant('resolve', resolve));
    $.register(constant('buildPackageConf', buildPackageConf));
    $.register(constant('buildPackageAssets', buildPackageAssets));
    $.register(constant('buildPackageGitHooks', buildPackageGitHooks));
    $.register(
      constant('fs', {
        accessAsync,
        readFileAsync,
        readdirAsync,
      }),
    );
    $.register(initMetapak);
  });

  test('should fail with no metapak config at all', async () => {
    accessAsync.mockRejectedValue(new Error('E_ACCESS'));
    readFileAsync.mockResolvedValue(Buffer.from('{}'));
    buildPackageConf.mockResolvedValue(false);
    buildPackageAssets.mockResolvedValue();
    buildPackageGitHooks.mockResolvedValue();

    const { metapak } = await $.run<{ metapak: MetapakService }>(['metapak']);

    await metapak();

    expect({
      readFileAsyncCalls: readFileAsync.mock.calls,
      logCalls: log.mock.calls.filter(filterLogs),
      exitCalls: exit.mock.calls,
      buildPackageConfCalls: buildPackageConf.mock.calls,
      buildPackageAssetsCalls: buildPackageAssets.mock.calls,
      buildPackageGitHooksCalls: buildPackageGitHooks.mock.calls,
    }).toMatchInlineSnapshot(`
      {
        "buildPackageAssetsCalls": [],
        "buildPackageConfCalls": [],
        "buildPackageGitHooksCalls": [],
        "exitCalls": [
          [
            1,
          ],
        ],
        "logCalls": [
          [
            "error",
            "❌ - Metapak config not found in the project "package.json" file.",
          ],
          [
            "error",
            "💀 - Could not run metapak script correctly:",
            "E_NO_METAPAK_CONFIG",
            [],
          ],
          [
            "warning",
            "💊 - Debug by running again with "DEBUG=metapak" env.",
          ],
        ],
        "readFileAsyncCalls": [
          [
            "project/dir/package.json",
          ],
        ],
      }
    `);
  });

  test('should silently fail with no metapak module', async () => {
    accessAsync.mockRejectedValue(new Error('E_ACCESS'));
    readFileAsync.mockResolvedValue(
      Buffer.from(
        JSON.stringify({
          metapak: {
            configs: [],
            data: {},
          },
        } as MetapakPackageJson<unknown, unknown>),
      ),
    );
    buildPackageConf.mockResolvedValue(false);
    buildPackageAssets.mockResolvedValue();
    buildPackageGitHooks.mockResolvedValue();

    const { metapak } = await $.run<{ metapak: MetapakService }>(['metapak']);

    await metapak();

    expect({
      readFileAsyncCalls: readFileAsync.mock.calls,
      logCalls: log.mock.calls.filter(filterLogs),
      exitCalls: exit.mock.calls,
      buildPackageConfCalls: buildPackageConf.mock.calls,
      buildPackageAssetsCalls: buildPackageAssets.mock.calls,
      buildPackageGitHooksCalls: buildPackageGitHooks.mock.calls,
    }).toMatchInlineSnapshot(`
      {
        "buildPackageAssetsCalls": [
          [
            {
              "metapak": {
                "configs": [],
                "data": {},
              },
            },
            {
              "configsSequence": [],
              "modulesConfigs": {},
              "modulesSequence": [],
            },
          ],
        ],
        "buildPackageConfCalls": [
          [
            {
              "metapak": {
                "configs": [],
                "data": {},
              },
            },
            {
              "configsSequence": [],
              "modulesConfigs": {},
              "modulesSequence": [],
            },
          ],
        ],
        "buildPackageGitHooksCalls": [
          [
            {
              "metapak": {
                "configs": [],
                "data": {},
              },
            },
            {
              "configsSequence": [],
              "modulesConfigs": {},
              "modulesSequence": [],
            },
          ],
        ],
        "exitCalls": [
          [
            0,
          ],
        ],
        "logCalls": [
          [
            "debug",
            "🤷 - No metapak modules found.",
          ],
        ],
        "readFileAsyncCalls": [
          [
            "project/dir/package.json",
          ],
        ],
      }
    `);
  });

  test('should fail with a bad package.json path', async () => {
    accessAsync.mockResolvedValue();
    readFileAsync.mockRejectedValue(new YError('E_AOUCH'));
    buildPackageConf.mockResolvedValue(false);
    buildPackageAssets.mockResolvedValue();
    buildPackageGitHooks.mockResolvedValue();

    const { metapak } = await $.run<{ metapak: MetapakService }>(['metapak']);

    await metapak();

    expect({
      readFileAsyncCalls: readFileAsync.mock.calls,
      logCalls: log.mock.calls.filter(filterLogs),
      exitCalls: exit.mock.calls,
      buildPackageConfCalls: buildPackageConf.mock.calls,
      buildPackageAssetsCalls: buildPackageAssets.mock.calls,
      buildPackageGitHooksCalls: buildPackageGitHooks.mock.calls,
    }).toMatchInlineSnapshot(`
      {
        "buildPackageAssetsCalls": [],
        "buildPackageConfCalls": [],
        "buildPackageGitHooksCalls": [],
        "exitCalls": [
          [
            1,
          ],
        ],
        "logCalls": [
          [
            "error",
            "💀 - Could not run metapak script correctly:",
            "E_AOUCH",
            [],
          ],
          [
            "warning",
            "💊 - Debug by running again with "DEBUG=metapak" env.",
          ],
        ],
        "readFileAsyncCalls": [
          [
            "project/dir/package.json",
          ],
        ],
      }
    `);
  });

  test('should fail with a malformed package.json', async () => {
    accessAsync.mockResolvedValue();
    readFileAsync.mockResolvedValue(Buffer.from('{""}'));
    buildPackageConf.mockResolvedValue(false);
    buildPackageAssets.mockResolvedValue();
    buildPackageGitHooks.mockResolvedValue();

    const { metapak } = await $.run<{ metapak: MetapakService }>(['metapak']);

    await metapak();

    expect({
      readFileAsyncCalls: readFileAsync.mock.calls,
      logCalls: log.mock.calls.filter(filterLogs),
      exitCalls: exit.mock.calls,
      buildPackageConfCalls: buildPackageConf.mock.calls,
      buildPackageAssetsCalls: buildPackageAssets.mock.calls,
      buildPackageGitHooksCalls: buildPackageGitHooks.mock.calls,
    }).toMatchInlineSnapshot(`
      {
        "buildPackageAssetsCalls": [],
        "buildPackageConfCalls": [],
        "buildPackageGitHooksCalls": [],
        "exitCalls": [
          [
            1,
          ],
        ],
        "logCalls": [
          [
            "error",
            "💀 - Could not run metapak script correctly:",
            "E_UNEXPECTED",
            [
              "Unexpected token } in JSON at position 3",
            ],
          ],
          [
            "warning",
            "💊 - Debug by running again with "DEBUG=metapak" env.",
          ],
        ],
        "readFileAsyncCalls": [
          [
            "project/dir/package.json",
          ],
        ],
      }
    `);
  });

  test('should fail with a bad sequence type', async () => {
    accessAsync.mockResolvedValue();
    readFileAsync.mockResolvedValue(
      Buffer.from(
        JSON.stringify({
          metapak: {
            sequence: 'unexisting_module',
          },
        }),
      ),
    );
    buildPackageConf.mockResolvedValue(false);
    buildPackageAssets.mockResolvedValue();
    buildPackageGitHooks.mockResolvedValue();

    const { metapak } = await $.run<{ metapak: MetapakService }>(['metapak']);

    await metapak();

    expect({
      readFileAsyncCalls: readFileAsync.mock.calls,
      logCalls: log.mock.calls.filter(filterLogs),
      exitCalls: exit.mock.calls,
      buildPackageConfCalls: buildPackageConf.mock.calls,
      buildPackageAssetsCalls: buildPackageAssets.mock.calls,
      buildPackageGitHooksCalls: buildPackageGitHooks.mock.calls,
    }).toMatchInlineSnapshot(`
      {
        "buildPackageAssetsCalls": [],
        "buildPackageConfCalls": [],
        "buildPackageGitHooksCalls": [],
        "exitCalls": [
          [
            1,
          ],
        ],
        "logCalls": [
          [
            "error",
            "💀 - Could not run metapak script correctly:",
            "E_BAD_SEQUENCE_TYPE",
            [
              "string",
              "unexisting_module",
            ],
          ],
          [
            "warning",
            "💊 - Debug by running again with "DEBUG=metapak" env.",
          ],
        ],
        "readFileAsyncCalls": [
          [
            "project/dir/package.json",
          ],
        ],
      }
    `);
  });

  test('should fail with a bad sequence item', async () => {
    accessAsync.mockResolvedValue();
    readFileAsync.mockResolvedValue(
      Buffer.from(
        JSON.stringify({
          metapak: {
            sequence: ['unexisting_module'],
            configs: [],
            data: {},
          },
        } as MetapakPackageJson<unknown, unknown>),
      ),
    );
    buildPackageConf.mockResolvedValue(false);
    buildPackageAssets.mockResolvedValue();
    buildPackageGitHooks.mockResolvedValue();

    const { metapak } = await $.run<{ metapak: MetapakService }>(['metapak']);

    await metapak();

    expect({
      readFileAsyncCalls: readFileAsync.mock.calls,
      logCalls: log.mock.calls.filter(filterLogs),
      exitCalls: exit.mock.calls,
      buildPackageConfCalls: buildPackageConf.mock.calls,
      buildPackageAssetsCalls: buildPackageAssets.mock.calls,
      buildPackageGitHooksCalls: buildPackageGitHooks.mock.calls,
    }).toMatchInlineSnapshot(`
      {
        "buildPackageAssetsCalls": [],
        "buildPackageConfCalls": [],
        "buildPackageGitHooksCalls": [],
        "exitCalls": [
          [
            1,
          ],
        ],
        "logCalls": [
          [
            "error",
            "💀 - Could not run metapak script correctly:",
            "E_BAD_SEQUENCE_ITEM",
            [
              "unexisting_module",
            ],
          ],
          [
            "warning",
            "💊 - Debug by running again with "DEBUG=metapak" env.",
          ],
        ],
        "readFileAsyncCalls": [
          [
            "project/dir/package.json",
          ],
        ],
      }
    `);
  });

  test('should fail with non-idempotent package transformer ', async () => {
    const packageConf: MetapakPackageJson<unknown, unknown> = {
      metapak: {
        configs: ['private'],
        data: {},
      },
      devDependencies: {
        'metapak-http-service': '1.0.0',
      },
    };

    readFileAsync.mockResolvedValueOnce(
      Buffer.from(JSON.stringify(packageConf)),
    );
    accessAsync.mockResolvedValue();
    readdirAsync.mockResolvedValue(['_common', 'private']);
    readFileAsync.mockResolvedValueOnce(
      Buffer.from(
        JSON.stringify({
          dependencies: {
            siso: '1.0.0',
            'strict-qs': '1.0.0',
          },
        }),
      ),
    );
    readFileAsync.mockResolvedValueOnce(
      Buffer.from(
        JSON.stringify({
          private: true,
        }),
      ),
    );
    buildPackageConf.mockResolvedValue(true);
    buildPackageAssets.mockResolvedValue();
    buildPackageGitHooks.mockResolvedValue();

    const { metapak } = await $.run<{ metapak: MetapakService }>(['metapak']);

    await metapak();

    expect({
      readFileAsyncCalls: readFileAsync.mock.calls,
      logCalls: log.mock.calls.filter(filterLogs),
      exitCalls: exit.mock.calls,
      buildPackageConfCalls: buildPackageConf.mock.calls,
      buildPackageAssetsCalls: buildPackageAssets.mock.calls,
      buildPackageGitHooksCalls: buildPackageGitHooks.mock.calls,
    }).toMatchInlineSnapshot(`
      {
        "buildPackageAssetsCalls": [],
        "buildPackageConfCalls": [
          [
            {
              "devDependencies": {
                "metapak-http-service": "1.0.0",
              },
              "metapak": {
                "configs": [
                  "private",
                ],
                "data": {},
              },
            },
            {
              "configsSequence": [
                "private",
              ],
              "modulesConfigs": {
                "metapak-http-service": {
                  "assetsDir": "src",
                  "base": "/home/whoami/project/dir/node_modules/metapak-http-service",
                  "configs": [
                    "_common",
                    "private",
                  ],
                  "srcDir": "dist",
                },
              },
              "modulesSequence": [
                "metapak-http-service",
              ],
            },
          ],
          [
            {
              "devDependencies": {
                "metapak-http-service": "1.0.0",
              },
              "metapak": {
                "configs": [
                  "private",
                ],
                "data": {},
              },
            },
            {
              "configsSequence": [
                "private",
              ],
              "modulesConfigs": {
                "metapak-http-service": {
                  "assetsDir": "src",
                  "base": "/home/whoami/project/dir/node_modules/metapak-http-service",
                  "configs": [
                    "_common",
                    "private",
                  ],
                  "srcDir": "dist",
                },
              },
              "modulesSequence": [
                "metapak-http-service",
              ],
            },
          ],
          [
            {
              "devDependencies": {
                "metapak-http-service": "1.0.0",
              },
              "metapak": {
                "configs": [
                  "private",
                ],
                "data": {},
              },
            },
            {
              "configsSequence": [
                "private",
              ],
              "modulesConfigs": {
                "metapak-http-service": {
                  "assetsDir": "src",
                  "base": "/home/whoami/project/dir/node_modules/metapak-http-service",
                  "configs": [
                    "_common",
                    "private",
                  ],
                  "srcDir": "dist",
                },
              },
              "modulesSequence": [
                "metapak-http-service",
              ],
            },
          ],
          [
            {
              "devDependencies": {
                "metapak-http-service": "1.0.0",
              },
              "metapak": {
                "configs": [
                  "private",
                ],
                "data": {},
              },
            },
            {
              "configsSequence": [
                "private",
              ],
              "modulesConfigs": {
                "metapak-http-service": {
                  "assetsDir": "src",
                  "base": "/home/whoami/project/dir/node_modules/metapak-http-service",
                  "configs": [
                    "_common",
                    "private",
                  ],
                  "srcDir": "dist",
                },
              },
              "modulesSequence": [
                "metapak-http-service",
              ],
            },
          ],
          [
            {
              "devDependencies": {
                "metapak-http-service": "1.0.0",
              },
              "metapak": {
                "configs": [
                  "private",
                ],
                "data": {},
              },
            },
            {
              "configsSequence": [
                "private",
              ],
              "modulesConfigs": {
                "metapak-http-service": {
                  "assetsDir": "src",
                  "base": "/home/whoami/project/dir/node_modules/metapak-http-service",
                  "configs": [
                    "_common",
                    "private",
                  ],
                  "srcDir": "dist",
                },
              },
              "modulesSequence": [
                "metapak-http-service",
              ],
            },
          ],
          [
            {
              "devDependencies": {
                "metapak-http-service": "1.0.0",
              },
              "metapak": {
                "configs": [
                  "private",
                ],
                "data": {},
              },
            },
            {
              "configsSequence": [
                "private",
              ],
              "modulesConfigs": {
                "metapak-http-service": {
                  "assetsDir": "src",
                  "base": "/home/whoami/project/dir/node_modules/metapak-http-service",
                  "configs": [
                    "_common",
                    "private",
                  ],
                  "srcDir": "dist",
                },
              },
              "modulesSequence": [
                "metapak-http-service",
              ],
            },
          ],
          [
            {
              "devDependencies": {
                "metapak-http-service": "1.0.0",
              },
              "metapak": {
                "configs": [
                  "private",
                ],
                "data": {},
              },
            },
            {
              "configsSequence": [
                "private",
              ],
              "modulesConfigs": {
                "metapak-http-service": {
                  "assetsDir": "src",
                  "base": "/home/whoami/project/dir/node_modules/metapak-http-service",
                  "configs": [
                    "_common",
                    "private",
                  ],
                  "srcDir": "dist",
                },
              },
              "modulesSequence": [
                "metapak-http-service",
              ],
            },
          ],
          [
            {
              "devDependencies": {
                "metapak-http-service": "1.0.0",
              },
              "metapak": {
                "configs": [
                  "private",
                ],
                "data": {},
              },
            },
            {
              "configsSequence": [
                "private",
              ],
              "modulesConfigs": {
                "metapak-http-service": {
                  "assetsDir": "src",
                  "base": "/home/whoami/project/dir/node_modules/metapak-http-service",
                  "configs": [
                    "_common",
                    "private",
                  ],
                  "srcDir": "dist",
                },
              },
              "modulesSequence": [
                "metapak-http-service",
              ],
            },
          ],
          [
            {
              "devDependencies": {
                "metapak-http-service": "1.0.0",
              },
              "metapak": {
                "configs": [
                  "private",
                ],
                "data": {},
              },
            },
            {
              "configsSequence": [
                "private",
              ],
              "modulesConfigs": {
                "metapak-http-service": {
                  "assetsDir": "src",
                  "base": "/home/whoami/project/dir/node_modules/metapak-http-service",
                  "configs": [
                    "_common",
                    "private",
                  ],
                  "srcDir": "dist",
                },
              },
              "modulesSequence": [
                "metapak-http-service",
              ],
            },
          ],
          [
            {
              "devDependencies": {
                "metapak-http-service": "1.0.0",
              },
              "metapak": {
                "configs": [
                  "private",
                ],
                "data": {},
              },
            },
            {
              "configsSequence": [
                "private",
              ],
              "modulesConfigs": {
                "metapak-http-service": {
                  "assetsDir": "src",
                  "base": "/home/whoami/project/dir/node_modules/metapak-http-service",
                  "configs": [
                    "_common",
                    "private",
                  ],
                  "srcDir": "dist",
                },
              },
              "modulesSequence": [
                "metapak-http-service",
              ],
            },
          ],
          [
            {
              "devDependencies": {
                "metapak-http-service": "1.0.0",
              },
              "metapak": {
                "configs": [
                  "private",
                ],
                "data": {},
              },
            },
            {
              "configsSequence": [
                "private",
              ],
              "modulesConfigs": {
                "metapak-http-service": {
                  "assetsDir": "src",
                  "base": "/home/whoami/project/dir/node_modules/metapak-http-service",
                  "configs": [
                    "_common",
                    "private",
                  ],
                  "srcDir": "dist",
                },
              },
              "modulesSequence": [
                "metapak-http-service",
              ],
            },
          ],
          [
            {
              "devDependencies": {
                "metapak-http-service": "1.0.0",
              },
              "metapak": {
                "configs": [
                  "private",
                ],
                "data": {},
              },
            },
            {
              "configsSequence": [
                "private",
              ],
              "modulesConfigs": {
                "metapak-http-service": {
                  "assetsDir": "src",
                  "base": "/home/whoami/project/dir/node_modules/metapak-http-service",
                  "configs": [
                    "_common",
                    "private",
                  ],
                  "srcDir": "dist",
                },
              },
              "modulesSequence": [
                "metapak-http-service",
              ],
            },
          ],
          [
            {
              "devDependencies": {
                "metapak-http-service": "1.0.0",
              },
              "metapak": {
                "configs": [
                  "private",
                ],
                "data": {},
              },
            },
            {
              "configsSequence": [
                "private",
              ],
              "modulesConfigs": {
                "metapak-http-service": {
                  "assetsDir": "src",
                  "base": "/home/whoami/project/dir/node_modules/metapak-http-service",
                  "configs": [
                    "_common",
                    "private",
                  ],
                  "srcDir": "dist",
                },
              },
              "modulesSequence": [
                "metapak-http-service",
              ],
            },
          ],
          [
            {
              "devDependencies": {
                "metapak-http-service": "1.0.0",
              },
              "metapak": {
                "configs": [
                  "private",
                ],
                "data": {},
              },
            },
            {
              "configsSequence": [
                "private",
              ],
              "modulesConfigs": {
                "metapak-http-service": {
                  "assetsDir": "src",
                  "base": "/home/whoami/project/dir/node_modules/metapak-http-service",
                  "configs": [
                    "_common",
                    "private",
                  ],
                  "srcDir": "dist",
                },
              },
              "modulesSequence": [
                "metapak-http-service",
              ],
            },
          ],
          [
            {
              "devDependencies": {
                "metapak-http-service": "1.0.0",
              },
              "metapak": {
                "configs": [
                  "private",
                ],
                "data": {},
              },
            },
            {
              "configsSequence": [
                "private",
              ],
              "modulesConfigs": {
                "metapak-http-service": {
                  "assetsDir": "src",
                  "base": "/home/whoami/project/dir/node_modules/metapak-http-service",
                  "configs": [
                    "_common",
                    "private",
                  ],
                  "srcDir": "dist",
                },
              },
              "modulesSequence": [
                "metapak-http-service",
              ],
            },
          ],
        ],
        "buildPackageGitHooksCalls": [],
        "exitCalls": [
          [
            1,
          ],
        ],
        "logCalls": [
          [
            "debug",
            "✅ - Resolved the metapak modules sequence:",
            [
              "metapak-http-service",
            ],
          ],
          [
            "debug",
            "📥 - Built config for "metapak-http-service:",
            {
              "assetsDir": "src",
              "base": "/home/whoami/project/dir/node_modules/metapak-http-service",
              "configs": [
                "_common",
                "private",
              ],
              "srcDir": "dist",
            },
          ],
          [
            "error",
            "🤷 - Reached the maximum allowed iterations. It means metapak keeps changing the repository and never reach a stable state. Probably that some operations made are not idempotent.",
          ],
          [
            "error",
            "💀 - Could not run metapak script correctly:",
            "E_MAX_ITERATIONS",
            [
              15,
              15,
            ],
          ],
          [
            "warning",
            "💊 - Debug by running again with "DEBUG=metapak" env.",
          ],
        ],
        "readFileAsyncCalls": [
          [
            "project/dir/package.json",
          ],
        ],
      }
    `);
  });

  test('should work with one module and several configs', async () => {
    const packageConf: MetapakPackageJson<unknown, unknown> = {
      metapak: {
        configs: ['_common', 'private'],
        data: {},
      },
      devDependencies: {
        'metapak-http-service': '1.0.0',
      },
    };

    readFileAsync.mockResolvedValueOnce(
      Buffer.from(JSON.stringify(packageConf)),
    );
    accessAsync.mockResolvedValue();
    readdirAsync.mockResolvedValue(['_common', 'private']);
    readFileAsync.mockResolvedValueOnce(
      Buffer.from(
        JSON.stringify({
          dependencies: {
            siso: '1.0.0',
            'strict-qs': '1.0.0',
          },
        }),
      ),
    );
    readFileAsync.mockResolvedValueOnce(
      Buffer.from(
        JSON.stringify({
          private: true,
        }),
      ),
    );
    buildPackageConf.mockResolvedValue(false);
    buildPackageAssets.mockResolvedValue();
    buildPackageGitHooks.mockResolvedValue();

    const { metapak } = await $.run<{ metapak: MetapakService }>(['metapak']);

    await metapak();

    expect({
      readFileAsyncCalls: readFileAsync.mock.calls,
      logCalls: log.mock.calls.filter(filterLogs),
      exitCalls: exit.mock.calls,
      buildPackageConfCalls: buildPackageConf.mock.calls,
      buildPackageAssetsCalls: buildPackageAssets.mock.calls,
      buildPackageGitHooksCalls: buildPackageGitHooks.mock.calls,
    }).toMatchInlineSnapshot(`
      {
        "buildPackageAssetsCalls": [
          [
            {
              "devDependencies": {
                "metapak-http-service": "1.0.0",
              },
              "metapak": {
                "configs": [
                  "_common",
                  "private",
                ],
                "data": {},
              },
            },
            {
              "configsSequence": [
                "_common",
                "private",
              ],
              "modulesConfigs": {
                "metapak-http-service": {
                  "assetsDir": "src",
                  "base": "/home/whoami/project/dir/node_modules/metapak-http-service",
                  "configs": [
                    "_common",
                    "private",
                  ],
                  "srcDir": "dist",
                },
              },
              "modulesSequence": [
                "metapak-http-service",
              ],
            },
          ],
        ],
        "buildPackageConfCalls": [
          [
            {
              "devDependencies": {
                "metapak-http-service": "1.0.0",
              },
              "metapak": {
                "configs": [
                  "_common",
                  "private",
                ],
                "data": {},
              },
            },
            {
              "configsSequence": [
                "_common",
                "private",
              ],
              "modulesConfigs": {
                "metapak-http-service": {
                  "assetsDir": "src",
                  "base": "/home/whoami/project/dir/node_modules/metapak-http-service",
                  "configs": [
                    "_common",
                    "private",
                  ],
                  "srcDir": "dist",
                },
              },
              "modulesSequence": [
                "metapak-http-service",
              ],
            },
          ],
        ],
        "buildPackageGitHooksCalls": [
          [
            {
              "devDependencies": {
                "metapak-http-service": "1.0.0",
              },
              "metapak": {
                "configs": [
                  "_common",
                  "private",
                ],
                "data": {},
              },
            },
            {
              "configsSequence": [
                "_common",
                "private",
              ],
              "modulesConfigs": {
                "metapak-http-service": {
                  "assetsDir": "src",
                  "base": "/home/whoami/project/dir/node_modules/metapak-http-service",
                  "configs": [
                    "_common",
                    "private",
                  ],
                  "srcDir": "dist",
                },
              },
              "modulesSequence": [
                "metapak-http-service",
              ],
            },
          ],
        ],
        "exitCalls": [
          [
            0,
          ],
        ],
        "logCalls": [
          [
            "debug",
            "✅ - Resolved the metapak modules sequence:",
            [
              "metapak-http-service",
            ],
          ],
          [
            "debug",
            "📥 - Built config for "metapak-http-service:",
            {
              "assetsDir": "src",
              "base": "/home/whoami/project/dir/node_modules/metapak-http-service",
              "configs": [
                "_common",
                "private",
              ],
              "srcDir": "dist",
            },
          ],
        ],
        "readFileAsyncCalls": [
          [
            "project/dir/package.json",
          ],
        ],
      }
    `);
  });

  test('should work with one module and one config', async () => {
    const packageConf: MetapakPackageJson<unknown, unknown> = {
      devDependencies: {
        'metapak-http-service': '1.0.0',
      },
      metapak: {
        configs: ['private'],
        data: {},
      },
    };

    readFileAsync.mockResolvedValueOnce(
      Buffer.from(JSON.stringify(packageConf)),
    );
    accessAsync.mockResolvedValue();
    readdirAsync.mockResolvedValue(['_common', 'private']);
    readFileAsync.mockResolvedValueOnce(
      Buffer.from(
        JSON.stringify({
          dependencies: {
            siso: '1.0.0',
            'strict-qs': '1.0.0',
          },
        }),
      ),
    );
    readFileAsync.mockResolvedValueOnce(
      Buffer.from(
        JSON.stringify({
          private: true,
        }),
      ),
    );
    buildPackageConf.mockResolvedValue(false);
    buildPackageAssets.mockResolvedValue();
    buildPackageGitHooks.mockResolvedValue();

    const { metapak } = await $.run<{ metapak: MetapakService }>(['metapak']);

    await metapak();

    expect({
      readFileAsyncCalls: readFileAsync.mock.calls,
      logCalls: log.mock.calls.filter(filterLogs),
      exitCalls: exit.mock.calls,
      buildPackageConfCalls: buildPackageConf.mock.calls,
      buildPackageAssetsCalls: buildPackageAssets.mock.calls,
      buildPackageGitHooksCalls: buildPackageGitHooks.mock.calls,
    }).toMatchInlineSnapshot(`
      {
        "buildPackageAssetsCalls": [
          [
            {
              "devDependencies": {
                "metapak-http-service": "1.0.0",
              },
              "metapak": {
                "configs": [
                  "private",
                ],
                "data": {},
              },
            },
            {
              "configsSequence": [
                "private",
              ],
              "modulesConfigs": {
                "metapak-http-service": {
                  "assetsDir": "src",
                  "base": "/home/whoami/project/dir/node_modules/metapak-http-service",
                  "configs": [
                    "_common",
                    "private",
                  ],
                  "srcDir": "dist",
                },
              },
              "modulesSequence": [
                "metapak-http-service",
              ],
            },
          ],
        ],
        "buildPackageConfCalls": [
          [
            {
              "devDependencies": {
                "metapak-http-service": "1.0.0",
              },
              "metapak": {
                "configs": [
                  "private",
                ],
                "data": {},
              },
            },
            {
              "configsSequence": [
                "private",
              ],
              "modulesConfigs": {
                "metapak-http-service": {
                  "assetsDir": "src",
                  "base": "/home/whoami/project/dir/node_modules/metapak-http-service",
                  "configs": [
                    "_common",
                    "private",
                  ],
                  "srcDir": "dist",
                },
              },
              "modulesSequence": [
                "metapak-http-service",
              ],
            },
          ],
        ],
        "buildPackageGitHooksCalls": [
          [
            {
              "devDependencies": {
                "metapak-http-service": "1.0.0",
              },
              "metapak": {
                "configs": [
                  "private",
                ],
                "data": {},
              },
            },
            {
              "configsSequence": [
                "private",
              ],
              "modulesConfigs": {
                "metapak-http-service": {
                  "assetsDir": "src",
                  "base": "/home/whoami/project/dir/node_modules/metapak-http-service",
                  "configs": [
                    "_common",
                    "private",
                  ],
                  "srcDir": "dist",
                },
              },
              "modulesSequence": [
                "metapak-http-service",
              ],
            },
          ],
        ],
        "exitCalls": [
          [
            0,
          ],
        ],
        "logCalls": [
          [
            "debug",
            "✅ - Resolved the metapak modules sequence:",
            [
              "metapak-http-service",
            ],
          ],
          [
            "debug",
            "📥 - Built config for "metapak-http-service:",
            {
              "assetsDir": "src",
              "base": "/home/whoami/project/dir/node_modules/metapak-http-service",
              "configs": [
                "_common",
                "private",
              ],
              "srcDir": "dist",
            },
          ],
        ],
        "readFileAsyncCalls": [
          [
            "project/dir/package.json",
          ],
        ],
      }
    `);
  });

  test('should work with one module and several overriden configs', async () => {
    const packageConf: MetapakPackageJson<unknown, unknown> = {
      devDependencies: {
        'metapak-http-service': '1.0.0',
      },
      metapak: {
        configs: ['private', 'bisous'],
        data: {},
      },
    };

    readFileAsync.mockResolvedValueOnce(
      Buffer.from(JSON.stringify(packageConf)),
    );
    accessAsync.mockResolvedValue();
    readdirAsync.mockResolvedValue(['_common', 'bisous', 'private', 'coucou']);
    readFileAsync.mockResolvedValueOnce(
      Buffer.from(
        JSON.stringify({
          dependencies: {
            siso: '1.0.0',
            'strict-qs': '1.0.0',
          },
        }),
      ),
    );
    readFileAsync.mockResolvedValueOnce(
      Buffer.from(
        JSON.stringify({
          private: true,
        }),
      ),
    );
    buildPackageConf.mockResolvedValue(false);
    buildPackageAssets.mockResolvedValue();
    buildPackageGitHooks.mockResolvedValue();

    const { metapak } = await $.run<{ metapak: MetapakService }>(['metapak']);

    await metapak();

    expect({
      readFileAsyncCalls: readFileAsync.mock.calls,
      logCalls: log.mock.calls.filter(filterLogs),
      exitCalls: exit.mock.calls,
      buildPackageConfCalls: buildPackageConf.mock.calls,
      buildPackageAssetsCalls: buildPackageAssets.mock.calls,
      buildPackageGitHooksCalls: buildPackageGitHooks.mock.calls,
    }).toMatchInlineSnapshot(`
      {
        "buildPackageAssetsCalls": [
          [
            {
              "devDependencies": {
                "metapak-http-service": "1.0.0",
              },
              "metapak": {
                "configs": [
                  "private",
                  "bisous",
                ],
                "data": {},
              },
            },
            {
              "configsSequence": [
                "private",
                "bisous",
              ],
              "modulesConfigs": {
                "metapak-http-service": {
                  "assetsDir": "src",
                  "base": "/home/whoami/project/dir/node_modules/metapak-http-service",
                  "configs": [
                    "_common",
                    "bisous",
                    "private",
                    "coucou",
                  ],
                  "srcDir": "dist",
                },
              },
              "modulesSequence": [
                "metapak-http-service",
              ],
            },
          ],
        ],
        "buildPackageConfCalls": [
          [
            {
              "devDependencies": {
                "metapak-http-service": "1.0.0",
              },
              "metapak": {
                "configs": [
                  "private",
                  "bisous",
                ],
                "data": {},
              },
            },
            {
              "configsSequence": [
                "private",
                "bisous",
              ],
              "modulesConfigs": {
                "metapak-http-service": {
                  "assetsDir": "src",
                  "base": "/home/whoami/project/dir/node_modules/metapak-http-service",
                  "configs": [
                    "_common",
                    "bisous",
                    "private",
                    "coucou",
                  ],
                  "srcDir": "dist",
                },
              },
              "modulesSequence": [
                "metapak-http-service",
              ],
            },
          ],
        ],
        "buildPackageGitHooksCalls": [
          [
            {
              "devDependencies": {
                "metapak-http-service": "1.0.0",
              },
              "metapak": {
                "configs": [
                  "private",
                  "bisous",
                ],
                "data": {},
              },
            },
            {
              "configsSequence": [
                "private",
                "bisous",
              ],
              "modulesConfigs": {
                "metapak-http-service": {
                  "assetsDir": "src",
                  "base": "/home/whoami/project/dir/node_modules/metapak-http-service",
                  "configs": [
                    "_common",
                    "bisous",
                    "private",
                    "coucou",
                  ],
                  "srcDir": "dist",
                },
              },
              "modulesSequence": [
                "metapak-http-service",
              ],
            },
          ],
        ],
        "exitCalls": [
          [
            0,
          ],
        ],
        "logCalls": [
          [
            "debug",
            "✅ - Resolved the metapak modules sequence:",
            [
              "metapak-http-service",
            ],
          ],
          [
            "debug",
            "📥 - Built config for "metapak-http-service:",
            {
              "assetsDir": "src",
              "base": "/home/whoami/project/dir/node_modules/metapak-http-service",
              "configs": [
                "_common",
                "bisous",
                "private",
                "coucou",
              ],
              "srcDir": "dist",
            },
          ],
        ],
        "readFileAsyncCalls": [
          [
            "project/dir/package.json",
          ],
        ],
      }
    `);
  });
});

function filterLogs(e: Parameters<LogService>) {
  return !e[0].endsWith('-stack');
}
