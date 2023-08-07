import { describe, beforeEach, test, jest, expect } from '@jest/globals';
import { Knifecycle, constant } from 'knifecycle';
import initBuildPackageConf from './packageConf.js';
import type { BuildPackageConfService } from './packageConf.js';
import type { FSService } from './fs.js';
import type { ImporterService, LogService } from 'common-services';
import type {
  MetapakPackageJson,
  PackageJSONTransformer,
} from '../libs/utils.js';
import type { JsonObject } from 'type-fest';

const METAPAK_SCRIPT = 'metapak';

describe('buildPackageConf', () => {
  const writeFileAsync = jest.fn<FSService['writeFileAsync']>();
  const importer = jest.fn<
    ImporterService<{
      default: PackageJSONTransformer<JsonObject, JsonObject>;
    }>
  >();
  const log = jest.fn<LogService>();
  let $: Knifecycle;

  beforeEach(() => {
    writeFileAsync.mockReset();
    importer.mockReset();
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
    $.register(initBuildPackageConf);
  });

  test('should work with one module and one config', async () => {
    const packageConf: MetapakPackageJson<JsonObject, JsonObject> = {
      metapak: {
        configs: ['_common'],
        data: {},
      },
    };

    importer.mockResolvedValueOnce({
      default: (packageConf) => {
        packageConf.private = true;
        return packageConf;
      },
    });
    writeFileAsync.mockResolvedValueOnce(undefined);

    const { buildPackageConf } = await $.run<{
      buildPackageConf: BuildPackageConfService;
    }>(['buildPackageConf']);
    const result = await buildPackageConf(packageConf, {
      configsSequence: ['_common'],
      modulesSequence: ['metapak-http-server'],
      modulesConfigs: {
        'metapak-http-server': {
          base: 'project/dir/node_modules/metapak-http-server',
          srcDir: 'src',
          assetsDir: 'src',
          configs: ['_common'],
        },
      },
    });

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
            "✅ - Package tranformation found at: project/dir/node_modules/metapak-http-server/src/_common/package.js",
          ],
          [
            "debug",
            "💾 - Saving the package:",
            "project/dir/package.json",
          ],
        ],
        "result": true,
        "writeFileAsyncCalls": [
          [
            "project/dir/package.json",
            "{
        "metapak": {
          "configs": [
            "_common"
          ],
          "data": {}
        },
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
    const packageConf: MetapakPackageJson<JsonObject, JsonObject> = {
      metapak: {
        configs: ['_common'],
        data: {},
      },
      scripts: {
        metapak: METAPAK_SCRIPT,
      },
    };

    importer.mockRejectedValue(new Error('E_ERROR'));
    writeFileAsync.mockResolvedValue(undefined);

    const { buildPackageConf } = await $.run<{
      buildPackageConf: BuildPackageConfService;
    }>(['buildPackageConf']);
    const result = await buildPackageConf(packageConf, {
      configsSequence: ['_common'],
      modulesSequence: ['metapak-http-server'],
      modulesConfigs: {
        'metapak-http-server': {
          base: 'project/dir/node_modules/metapak-http-server',
          srcDir: 'src',
          assetsDir: 'src',
          configs: ['_common'],
        },
      },
    });

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
            "🤷 - No package tranformation found at: project/dir/node_modules/metapak-http-server/src/_common/package.js",
          ],
        ],
        "result": false,
        "writeFileAsyncCalls": [],
      }
    `);
  });

  test('should work with several modules and configs', async () => {
    const packageConf: MetapakPackageJson<JsonObject, JsonObject> = {
      metapak: {
        configs: ['_common', 'author'],
        data: {},
      },
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

    const { buildPackageConf } = await $.run<{
      buildPackageConf: BuildPackageConfService;
    }>(['buildPackageConf']);
    const result = await buildPackageConf(packageConf, {
      configsSequence: ['_common', 'author'],
      modulesSequence: ['metapak-http-server', 'metapak-schmilbik'],
      modulesConfigs: {
        'metapak-http-server': {
          base: 'project/dir/node_modules/metapak-http-server',
          srcDir: 'src',
          assetsDir: 'src',
          configs: ['_common'],
        },
        'metapak-schmilbik': {
          base: 'project/dir/node_modules/metapak-schmilbik',
          srcDir: 'src',
          assetsDir: 'src',
          configs: ['_common', 'author'],
        },
      },
    });

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
            "project/dir/node_modules/metapak-http-server/src/author/package.js",
          ],
          [
            "project/dir/node_modules/metapak-schmilbik/src/author/package.js",
          ],
        ],
        "logCalls": [
          [
            "debug",
            "✅ - Package tranformation found at: project/dir/node_modules/metapak-http-server/src/_common/package.js",
          ],
          [
            "debug",
            "✅ - Package tranformation found at: project/dir/node_modules/metapak-schmilbik/src/_common/package.js",
          ],
          [
            "debug",
            "✅ - Package tranformation found at: project/dir/node_modules/metapak-http-server/src/author/package.js",
          ],
          [
            "debug",
            "🤷 - No package tranformation found at: project/dir/node_modules/metapak-schmilbik/src/author/package.js",
          ],
          [
            "debug",
            "💾 - Saving the package:",
            "project/dir/package.json",
          ],
        ],
        "result": true,
        "writeFileAsyncCalls": [
          [
            "project/dir/package.json",
            "{
        "metapak": {
          "configs": [
            "_common",
            "author"
          ],
          "data": {}
        },
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
