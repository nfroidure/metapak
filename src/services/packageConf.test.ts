import { describe, beforeEach, test, jest, expect } from '@jest/globals';
import { Knifecycle, constant } from 'knifecycle';
import initBuildPackageConf from './packageConf.js';
import type { FSService } from './fs.js';
import type { ImporterService, LogService } from 'common-services';
import type { ResolveModuleService } from './resolveModule.js';
import { PackageJSONTransformer } from '../libs/utils.js';

const METAPAK_SCRIPT = 'metapak';

describe('buildPackageConf', () => {
  let $;
  const writeFileAsync = jest.fn<FSService['writeFileAsync']>();
  const importer =
    jest.fn<ImporterService<{ default: PackageJSONTransformer }>>();
  const resolveModule = jest.fn<ResolveModuleService>(
    (moduleName) => `project/dir/node_modules/${moduleName}`,
  );
  const log = jest.fn<LogService>();

  beforeEach(() => {
    writeFileAsync.mockReset();
    importer.mockReset();
    resolveModule.mockClear();
    log.mockReset();

    $ = new Knifecycle();
    $.register(constant('ENV', {}));
    $.register(constant('log', log));
    $.register(constant('PROJECT_DIR', 'project/dir'));
    $.register(
      constant('fs', {
        writeFileAsync,
      }),
    );
    $.register(constant('importer', importer));
    $.register(constant('resolveModule', resolveModule));
    $.register(initBuildPackageConf);
  });

  test('should work with one module and one config', async () => {
    const packageConf = {};

    importer.mockResolvedValueOnce({
      default: (packageConf) => {
        packageConf.private = true;
        return packageConf;
      },
    });
    writeFileAsync.mockResolvedValueOnce(undefined);

    const { buildPackageConf } = await $.run(['buildPackageConf']);
    const result = await buildPackageConf(
      packageConf,
      ['metapak-http-server'],
      {
        'metapak-http-server': ['_common'],
      },
    );

    expect({
      importerCalls: importer.mock.calls,
      writeFileAsyncCalls: writeFileAsync.mock.calls.map(bufferToText),
      logCalls: log.mock.calls.filter(filterLogs),
      result,
    }).toMatchInlineSnapshot(`
      {
        "importerCalls": [
          [
            "project/dir/node_modules/metapak-http-server/src/_common/package.js",
          ],
        ],
        "logCalls": [
          [
            "debug",
            "Package tranformation found at: project/dir/node_modules/metapak-http-server/src/_common/package.js",
          ],
          [
            "debug",
            "Saving the package:",
            "project/dir/package.json",
          ],
        ],
        "result": true,
        "writeFileAsyncCalls": [
          [
            "project/dir/package.json",
            "{
        "scripts": {
          "metapak": "metapak"
        },
        "private": true
      }",
            undefined,
          ],
        ],
      }
    `);
  });

  test('should work with no tranformations', async () => {
    const packageConf = {
      scripts: {
        metapak: METAPAK_SCRIPT,
      },
    };

    importer.mockRejectedValue(new Error('E_ERROR'));
    writeFileAsync.mockResolvedValue(undefined);

    const { buildPackageConf } = await $.run(['buildPackageConf']);
    const result = await buildPackageConf(
      packageConf,
      ['metapak-http-server'],
      {
        'metapak-http-server': ['_common'],
      },
    );

    expect({
      importerCalls: importer.mock.calls,
      writeFileAsyncCalls: writeFileAsync.mock.calls.map(bufferToText),
      logCalls: log.mock.calls.filter(filterLogs),
      result,
    }).toMatchInlineSnapshot(`
      {
        "importerCalls": [
          [
            "project/dir/node_modules/metapak-http-server/src/_common/package.js",
          ],
        ],
        "logCalls": [
          [
            "debug",
            "No package tranformation found at: project/dir/node_modules/metapak-http-server/src/_common/package.js",
          ],
        ],
        "result": false,
        "writeFileAsyncCalls": [],
      }
    `);
  });

  test('should work with several modules and configs', async () => {
    const packageConf = {
      scripts: {
        metapak: METAPAK_SCRIPT,
      },
    };

    importer.mockResolvedValueOnce({
      default: (packageConf) => {
        packageConf.private = true;
        return packageConf;
      },
    });
    importer.mockResolvedValueOnce({
      default: (packageConf) => {
        packageConf.license = 'MIT';
        return packageConf;
      },
    });
    importer.mockResolvedValueOnce({
      default: (packageConf) => {
        packageConf.author = 'John Doe';
        return packageConf;
      },
    });
    writeFileAsync.mockResolvedValue(undefined);

    const { buildPackageConf } = await $.run(['buildPackageConf']);
    const result = await buildPackageConf(
      packageConf,
      ['metapak-http-server', 'metapak-schmilbik'],
      {
        'metapak-http-server': ['_common'],
        'metapak-schmilbik': ['_common', 'author'],
      },
    );

    expect({
      importerCalls: importer.mock.calls,
      writeFileAsyncCalls: writeFileAsync.mock.calls.map(bufferToText),
      logCalls: log.mock.calls.filter(filterLogs),
      result,
    }).toMatchInlineSnapshot(`
      {
        "importerCalls": [
          [
            "project/dir/node_modules/metapak-http-server/src/_common/package.js",
          ],
          [
            "project/dir/node_modules/metapak-schmilbik/src/_common/package.js",
          ],
          [
            "project/dir/node_modules/metapak-schmilbik/src/author/package.js",
          ],
        ],
        "logCalls": [
          [
            "debug",
            "Package tranformation found at: project/dir/node_modules/metapak-http-server/src/_common/package.js",
          ],
          [
            "debug",
            "Package tranformation found at: project/dir/node_modules/metapak-schmilbik/src/_common/package.js",
          ],
          [
            "debug",
            "Package tranformation found at: project/dir/node_modules/metapak-schmilbik/src/author/package.js",
          ],
          [
            "debug",
            "Saving the package:",
            "project/dir/package.json",
          ],
        ],
        "result": true,
        "writeFileAsyncCalls": [
          [
            "project/dir/package.json",
            "{
        "scripts": {
          "metapak": "metapak"
        },
        "private": true,
        "license": "MIT",
        "author": "John Doe"
      }",
            undefined,
          ],
        ],
      }
    `);
  });
});

function bufferToText(
  call: Parameters<FSService['writeFileAsync']>,
): [string, string, Parameters<FSService['writeFileAsync']>[2]] {
  return [call[0], call[1].toString(), call[2]];
}

function filterLogs(e: Parameters<LogService>) {
  return !e[0].endsWith('-stack');
}
