import { describe, beforeEach, test, jest, expect } from '@jest/globals';
import { Knifecycle, constant } from 'knifecycle';
import initMetapak from './metapak.js';
import { YError } from 'yerror';
import { LogService } from 'common-services';
import { ResolveModuleService } from './resolveModule.js';
import { BuildPackageConfService } from './packageConf.js';
import { BuildPackageAssetsService } from './assets.js';
import { BuildPackageGitHooksService } from './gitHooks.js';
import { FSService } from './fs.js';

describe('metapak', () => {
  let $;
  const buildPackageConf = jest.fn<BuildPackageConfService>();
  const buildPackageAssets = jest.fn<BuildPackageAssetsService>();
  const buildPackageGitHooks = jest.fn<BuildPackageGitHooksService>();
  const resolveModule = jest.fn<ResolveModuleService>(
    (moduleName) => `project/dir/node_modules/${moduleName}`,
  );
  const readFileAsync = jest.fn<FSService['readFileAsync']>();
  const readdirAsync = jest.fn<FSService['readdirAsync']>();
  const log = jest.fn<LogService>();
  const exit = jest.fn<typeof process.exit>();

  beforeEach(() => {
    log.mockReset();
    exit.mockReset();
    readFileAsync.mockReset();
    readdirAsync.mockReset();
    resolveModule.mockClear();
    buildPackageConf.mockReset();
    buildPackageAssets.mockReset();
    buildPackageGitHooks.mockReset();

    $ = new Knifecycle();
    $.register(constant('ENV', {}));
    $.register(constant('log', log));
    $.register(constant('exit', exit));
    $.register(constant('PROJECT_DIR', 'project/dir'));
    $.register(constant('resolveModule', resolveModule));
    $.register(constant('buildPackageConf', buildPackageConf));
    $.register(constant('buildPackageAssets', buildPackageAssets));
    $.register(constant('buildPackageGitHooks', buildPackageGitHooks));
    $.register(
      constant('fs', {
        readFileAsync,
        readdirAsync,
      }),
    );
    $.register(initMetapak);
  });

  test('should silently fail with no metapak module', async () => {
    readFileAsync.mockResolvedValue(Buffer.from('{}'));
    buildPackageConf.mockResolvedValue(false);
    buildPackageAssets.mockResolvedValue();
    buildPackageGitHooks.mockResolvedValue();

    const { metapak } = await $.run(['metapak']);

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
            {},
            [],
            {},
          ],
        ],
        "buildPackageConfCalls": [
          [
            {},
            [],
            {},
          ],
        ],
        "buildPackageGitHooksCalls": [
          [
            {},
            [],
            {},
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
            "No metapak modules found.",
          ],
        ],
        "readFileAsyncCalls": [
          [
            "project/dir/package.json",
            "utf-8",
          ],
        ],
      }
    `);
  });

  test('should fail with a bad package.json path', async () => {
    readFileAsync.mockRejectedValue(new YError('E_AOUCH'));
    buildPackageConf.mockResolvedValue(false);
    buildPackageAssets.mockResolvedValue();
    buildPackageGitHooks.mockResolvedValue();

    const { metapak } = await $.run(['metapak']);

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
            "E_PACKAGE_NOT_FOUND",
            [
              "project/dir/package.json",
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
            "utf-8",
          ],
        ],
      }
    `);
  });

  test('should fail with a malformed package.json', async () => {
    readFileAsync.mockResolvedValue(Buffer.from('{""}'));
    buildPackageConf.mockResolvedValue(false);
    buildPackageAssets.mockResolvedValue();
    buildPackageGitHooks.mockResolvedValue();

    const { metapak } = await $.run(['metapak']);

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
            "E_MALFORMED_PACKAGE",
            [
              "project/dir/package.json",
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
            "utf-8",
          ],
        ],
      }
    `);
  });

  test('should fail with a bad sequence type', async () => {
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

    const { metapak } = await $.run(['metapak']);

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
            "utf-8",
          ],
        ],
      }
    `);
  });

  test('should fail with a bad sequence item', async () => {
    readFileAsync.mockResolvedValue(
      Buffer.from(
        JSON.stringify({
          metapak: {
            sequence: ['unexisting_module'],
          },
        }),
      ),
    );
    buildPackageConf.mockResolvedValue(false);
    buildPackageAssets.mockResolvedValue();
    buildPackageGitHooks.mockResolvedValue();

    const { metapak } = await $.run(['metapak']);

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
            "utf-8",
          ],
        ],
      }
    `);
  });

  test('should fail with non-idempotent package transformer ', async () => {
    const packageConf = {
      devDependencies: {
        'metapak-http-service': '1.0.0',
      },
    };

    readFileAsync.mockResolvedValueOnce(
      Buffer.from(JSON.stringify(packageConf)),
    );
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

    const { metapak } = await $.run(['metapak']);

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
            },
            [
              "metapak-http-service",
            ],
            {
              "metapak-http-service": [
                "_common",
              ],
            },
          ],
          [
            {
              "devDependencies": {
                "metapak-http-service": "1.0.0",
              },
            },
            [
              "metapak-http-service",
            ],
            {
              "metapak-http-service": [
                "_common",
              ],
            },
          ],
          [
            {
              "devDependencies": {
                "metapak-http-service": "1.0.0",
              },
            },
            [
              "metapak-http-service",
            ],
            {
              "metapak-http-service": [
                "_common",
              ],
            },
          ],
          [
            {
              "devDependencies": {
                "metapak-http-service": "1.0.0",
              },
            },
            [
              "metapak-http-service",
            ],
            {
              "metapak-http-service": [
                "_common",
              ],
            },
          ],
          [
            {
              "devDependencies": {
                "metapak-http-service": "1.0.0",
              },
            },
            [
              "metapak-http-service",
            ],
            {
              "metapak-http-service": [
                "_common",
              ],
            },
          ],
          [
            {
              "devDependencies": {
                "metapak-http-service": "1.0.0",
              },
            },
            [
              "metapak-http-service",
            ],
            {
              "metapak-http-service": [
                "_common",
              ],
            },
          ],
          [
            {
              "devDependencies": {
                "metapak-http-service": "1.0.0",
              },
            },
            [
              "metapak-http-service",
            ],
            {
              "metapak-http-service": [
                "_common",
              ],
            },
          ],
          [
            {
              "devDependencies": {
                "metapak-http-service": "1.0.0",
              },
            },
            [
              "metapak-http-service",
            ],
            {
              "metapak-http-service": [
                "_common",
              ],
            },
          ],
          [
            {
              "devDependencies": {
                "metapak-http-service": "1.0.0",
              },
            },
            [
              "metapak-http-service",
            ],
            {
              "metapak-http-service": [
                "_common",
              ],
            },
          ],
          [
            {
              "devDependencies": {
                "metapak-http-service": "1.0.0",
              },
            },
            [
              "metapak-http-service",
            ],
            {
              "metapak-http-service": [
                "_common",
              ],
            },
          ],
          [
            {
              "devDependencies": {
                "metapak-http-service": "1.0.0",
              },
            },
            [
              "metapak-http-service",
            ],
            {
              "metapak-http-service": [
                "_common",
              ],
            },
          ],
          [
            {
              "devDependencies": {
                "metapak-http-service": "1.0.0",
              },
            },
            [
              "metapak-http-service",
            ],
            {
              "metapak-http-service": [
                "_common",
              ],
            },
          ],
          [
            {
              "devDependencies": {
                "metapak-http-service": "1.0.0",
              },
            },
            [
              "metapak-http-service",
            ],
            {
              "metapak-http-service": [
                "_common",
              ],
            },
          ],
          [
            {
              "devDependencies": {
                "metapak-http-service": "1.0.0",
              },
            },
            [
              "metapak-http-service",
            ],
            {
              "metapak-http-service": [
                "_common",
              ],
            },
          ],
          [
            {
              "devDependencies": {
                "metapak-http-service": "1.0.0",
              },
            },
            [
              "metapak-http-service",
            ],
            {
              "metapak-http-service": [
                "_common",
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
            "Resolved the metapak modules sequence:",
            [
              "metapak-http-service",
            ],
          ],
          [
            "debug",
            "Found configs for "metapak-http-service":",
            [
              "_common",
            ],
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
            "utf-8",
          ],
        ],
      }
    `);
  });

  test('should work with one module and several configs', async () => {
    const packageConf = {
      devDependencies: {
        'metapak-http-service': '1.0.0',
      },
    };

    readFileAsync.mockResolvedValueOnce(
      Buffer.from(JSON.stringify(packageConf)),
    );
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

    const { metapak } = await $.run(['metapak']);

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
            },
            [
              "metapak-http-service",
            ],
            {
              "metapak-http-service": [
                "_common",
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
            },
            [
              "metapak-http-service",
            ],
            {
              "metapak-http-service": [
                "_common",
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
            },
            [
              "metapak-http-service",
            ],
            {
              "metapak-http-service": [
                "_common",
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
            "Resolved the metapak modules sequence:",
            [
              "metapak-http-service",
            ],
          ],
          [
            "debug",
            "Found configs for "metapak-http-service":",
            [
              "_common",
            ],
          ],
        ],
        "readFileAsyncCalls": [
          [
            "project/dir/package.json",
            "utf-8",
          ],
        ],
      }
    `);
  });

  test('should work with one module and one config', async () => {
    const packageConf = {
      devDependencies: {
        'metapak-http-service': '1.0.0',
      },
      metapak: {
        configs: ['private'],
      },
    };

    readFileAsync.mockResolvedValueOnce(
      Buffer.from(JSON.stringify(packageConf)),
    );
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

    const { metapak } = await $.run(['metapak']);

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
              },
            },
            [
              "metapak-http-service",
            ],
            {
              "metapak-http-service": [
                "_common",
                "private",
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
              },
            },
            [
              "metapak-http-service",
            ],
            {
              "metapak-http-service": [
                "_common",
                "private",
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
              },
            },
            [
              "metapak-http-service",
            ],
            {
              "metapak-http-service": [
                "_common",
                "private",
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
            "Resolved the metapak modules sequence:",
            [
              "metapak-http-service",
            ],
          ],
          [
            "debug",
            "Found configs for "metapak-http-service":",
            [
              "_common",
              "private",
            ],
          ],
        ],
        "readFileAsyncCalls": [
          [
            "project/dir/package.json",
            "utf-8",
          ],
        ],
      }
    `);
  });

  test('should work with one module and several overriden configs', async () => {
    const packageConf = {
      devDependencies: {
        'metapak-http-service': '1.0.0',
      },
      metapak: {
        configs: ['private', 'bisous'],
      },
    };

    readFileAsync.mockResolvedValueOnce(
      Buffer.from(JSON.stringify(packageConf)),
    );
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

    const { metapak } = await $.run(['metapak']);

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
              },
            },
            [
              "metapak-http-service",
            ],
            {
              "metapak-http-service": [
                "_common",
                "private",
                "bisous",
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
              },
            },
            [
              "metapak-http-service",
            ],
            {
              "metapak-http-service": [
                "_common",
                "private",
                "bisous",
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
              },
            },
            [
              "metapak-http-service",
            ],
            {
              "metapak-http-service": [
                "_common",
                "private",
                "bisous",
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
            "Resolved the metapak modules sequence:",
            [
              "metapak-http-service",
            ],
          ],
          [
            "debug",
            "Found configs for "metapak-http-service":",
            [
              "_common",
              "private",
              "bisous",
            ],
          ],
        ],
        "readFileAsyncCalls": [
          [
            "project/dir/package.json",
            "utf-8",
          ],
        ],
      }
    `);
  });
});

function filterLogs(e: Parameters<LogService>) {
  return !e[0].endsWith('-stack');
}
