import { describe, beforeEach, test, jest, expect } from '@jest/globals';
import { Knifecycle, constant } from 'knifecycle';
import initBuildPackageAssets from './assets.js';
import type {
  BuildPackageAssetsService,
  PackageAssetsTransformer,
} from './assets.js';
import type { ImporterService, LogService } from 'common-services';
import type { FSService } from './fs.js';
import type { MetapakPackageJson } from '../libs/utils.js';
import type { JsonObject } from 'type-fest';

describe('buildPackageAssets', () => {
  const readFileAsync = jest.fn<FSService['readFileAsync']>();
  const writeFileAsync = jest.fn<FSService['writeFileAsync']>();
  const unlinkAsync = jest.fn<FSService['unlinkAsync']>();
  const mkdirpAsync = jest.fn<FSService['mkdirpAsync']>();
  const importer = jest.fn<
    ImporterService<{
      default: PackageAssetsTransformer<JsonObject, JsonObject>;
    }>
  >();
  const glob = jest.fn<() => Promise<string[]>>();
  const log = jest.fn<LogService>();
  let $: Knifecycle;

  beforeEach(() => {
    readFileAsync.mockReset();
    writeFileAsync.mockReset();
    unlinkAsync.mockReset();
    mkdirpAsync.mockReset();
    importer.mockReset();
    glob.mockReset();
    log.mockReset();

    $ = new Knifecycle();
    $.register(constant('ENV', {}));
    $.register(constant('log', log));
    $.register(constant('glob', glob));
    $.register(constant('PROJECT_DIR', 'project/dir'));
    $.register(
      constant('fs', {
        readFileAsync: readFileAsync,
        writeFileAsync: writeFileAsync,
        unlinkAsync: unlinkAsync,
        mkdirpAsync: mkdirpAsync,
      }),
    );
    $.register(constant('importer', importer));
    $.register(initBuildPackageAssets);
  });

  test('should work when data changed', async () => {
    const packageConf: MetapakPackageJson<JsonObject, JsonObject> = {
      metapak: {
        configs: ['_common', 'author'],
        data: {},
      },
    };

    importer.mockResolvedValue({
      default: async (file) => {
        file.data = '{\n  "private": false\n}';
        return file;
      },
    });
    readFileAsync.mockResolvedValueOnce(Buffer.from('{\n  "test": true\n}'));
    readFileAsync.mockResolvedValueOnce(Buffer.from('{\n  "private": true\n}'));
    writeFileAsync.mockResolvedValue(undefined);
    unlinkAsync.mockResolvedValue(undefined);
    mkdirpAsync.mockResolvedValue(undefined);
    glob.mockResolvedValue(['lol']);

    const { buildPackageAssets } = await $.run<{
      buildPackageAssets: BuildPackageAssetsService;
    }>(['buildPackageAssets']);
    const result = await buildPackageAssets(packageConf, {
      configsSequence: ['_common', 'author'],
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
      globCalls: glob.mock.calls,
      importerCalls: importer.mock.calls,
      readFileAsyncCalls: readFileAsync.mock.calls,
      mkdirpAsyncCalls: mkdirpAsync.mock.calls,
      writeFileAsyncCalls: writeFileAsync.mock.calls.map(bufferToText),
      unlinkAsyncCalls: unlinkAsync.mock.calls,
      logCalls: log.mock.calls.filter(filterLogs),
      result,
    }).toMatchInlineSnapshot(`
      {
        "globCalls": [
          [
            "**/*",
            {
              "cwd": "project/dir/node_modules/metapak-http-server/src/_common/assets",
              "dot": true,
              "nodir": true,
            },
          ],
          [
            "**/*",
            {
              "cwd": "project/dir/node_modules/metapak-http-server/src/author/assets",
              "dot": true,
              "nodir": true,
            },
          ],
        ],
        "importerCalls": [
          [
            "project/dir/node_modules/metapak-http-server/src/_common/assets.js",
          ],
          [
            "project/dir/node_modules/metapak-http-server/src/author/assets.js",
          ],
        ],
        "logCalls": [
          [
            "debug",
            "Processing asset:",
            "project/dir/node_modules/metapak-http-server/src/author/assets/lol",
          ],
          [
            "debug",
            "Saving asset:",
            "project/dir/lol",
          ],
        ],
        "mkdirpAsyncCalls": [],
        "readFileAsyncCalls": [
          [
            "project/dir/node_modules/metapak-http-server/src/author/assets/lol",
          ],
          [
            "project/dir/lol",
          ],
        ],
        "result": true,
        "unlinkAsyncCalls": [],
        "writeFileAsyncCalls": [
          [
            "project/dir/lol",
            "{
        "private": false
      }",
            undefined,
          ],
        ],
      }
    `);
  });

  test('should rename _dot_ prefixed files', async () => {
    const packageConf: MetapakPackageJson<JsonObject, JsonObject> = {
      metapak: {
        configs: ['_common'],
        data: {},
      },
    };

    importer.mockResolvedValue({
      default: async (file) => {
        file.data = '{\n  "private": false\n}';
        return file;
      },
    });
    readFileAsync.mockResolvedValueOnce(Buffer.from('{\n  "test": true\n}'));
    readFileAsync.mockResolvedValueOnce(Buffer.from('{\n  "private": true\n}'));
    writeFileAsync.mockResolvedValue(undefined);
    unlinkAsync.mockResolvedValue(undefined);
    mkdirpAsync.mockResolvedValue(undefined);
    glob.mockResolvedValue(['_dot_gitignore']);

    const { buildPackageAssets } = await $.run<{
      buildPackageAssets: BuildPackageAssetsService;
    }>(['buildPackageAssets']);
    const result = await buildPackageAssets(packageConf, {
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
      globCalls: glob.mock.calls,
      importerCalls: importer.mock.calls,
      readFileAsyncCalls: readFileAsync.mock.calls,
      mkdirpAsyncCalls: mkdirpAsync.mock.calls,
      writeFileAsyncCalls: writeFileAsync.mock.calls.map(bufferToText),
      unlinkAsyncCalls: unlinkAsync.mock.calls,
      logCalls: log.mock.calls.filter(filterLogs),
      result,
    }).toMatchInlineSnapshot(`
      {
        "globCalls": [
          [
            "**/*",
            {
              "cwd": "project/dir/node_modules/metapak-http-server/src/_common/assets",
              "dot": true,
              "nodir": true,
            },
          ],
        ],
        "importerCalls": [
          [
            "project/dir/node_modules/metapak-http-server/src/_common/assets.js",
          ],
        ],
        "logCalls": [
          [
            "debug",
            "Processing asset:",
            "project/dir/node_modules/metapak-http-server/src/_common/assets/_dot_gitignore",
          ],
          [
            "debug",
            "Saving asset:",
            "project/dir/.gitignore",
          ],
        ],
        "mkdirpAsyncCalls": [],
        "readFileAsyncCalls": [
          [
            "project/dir/node_modules/metapak-http-server/src/_common/assets/_dot_gitignore",
          ],
          [
            "project/dir/.gitignore",
          ],
        ],
        "result": true,
        "unlinkAsyncCalls": [],
        "writeFileAsyncCalls": [
          [
            "project/dir/.gitignore",
            "{
        "private": false
      }",
            undefined,
          ],
        ],
      }
    `);
  });

  test('should warn on using .gitignore files', async () => {
    const packageConf: MetapakPackageJson<JsonObject, JsonObject> = {
      metapak: {
        configs: ['_common'],
        data: {},
      },
    };

    importer.mockResolvedValue({
      default: async (file) => {
        file.data = '{\n  "private": false\n}';
        return file;
      },
    });
    readFileAsync.mockResolvedValueOnce(Buffer.from('{\n  "test": true\n}'));
    readFileAsync.mockResolvedValueOnce(Buffer.from('{\n  "private": true\n}'));
    writeFileAsync.mockResolvedValue(undefined);
    unlinkAsync.mockResolvedValue(undefined);
    mkdirpAsync.mockResolvedValue(undefined);
    glob.mockResolvedValue(['.gitignore']);

    const { buildPackageAssets } = await $.run<{
      buildPackageAssets: BuildPackageAssetsService;
    }>(['buildPackageAssets']);
    const result = await buildPackageAssets(packageConf, {
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
      globCalls: glob.mock.calls,
      importerCalls: importer.mock.calls,
      readFileAsyncCalls: readFileAsync.mock.calls,
      mkdirpAsyncCalls: mkdirpAsync.mock.calls,
      writeFileAsyncCalls: writeFileAsync.mock.calls.map(bufferToText),
      unlinkAsyncCalls: unlinkAsync.mock.calls,
      logCalls: log.mock.calls.filter(filterLogs),
      result,
    }).toMatchInlineSnapshot(`
      {
        "globCalls": [
          [
            "**/*",
            {
              "cwd": "project/dir/node_modules/metapak-http-server/src/_common/assets",
              "dot": true,
              "nodir": true,
            },
          ],
        ],
        "importerCalls": [
          [
            "project/dir/node_modules/metapak-http-server/src/_common/assets.js",
          ],
        ],
        "logCalls": [
          [
            "warning",
            "\`.gitignore\` assets may not work, use \`_dot_\` instead of a raw \`.\`",
          ],
          [
            "warning",
            "in your \`assets\` folder, metapak will care to rename them",
          ],
          [
            "warning",
            "correctly. See https://github.com/npm/npm/issues/15660",
          ],
          [
            "debug",
            "Processing asset:",
            "project/dir/node_modules/metapak-http-server/src/_common/assets/.gitignore",
          ],
          [
            "debug",
            "Saving asset:",
            "project/dir/.gitignore",
          ],
        ],
        "mkdirpAsyncCalls": [],
        "readFileAsyncCalls": [
          [
            "project/dir/node_modules/metapak-http-server/src/_common/assets/.gitignore",
          ],
          [
            "project/dir/.gitignore",
          ],
        ],
        "result": true,
        "unlinkAsyncCalls": [],
        "writeFileAsyncCalls": [
          [
            "project/dir/.gitignore",
            "{
        "private": false
      }",
            undefined,
          ],
        ],
      }
    `);
  });

  test('should work whith several transformers', async () => {
    const packageConf: MetapakPackageJson<JsonObject, JsonObject> = {
      metapak: {
        configs: ['_common'],
        data: {},
      },
    };

    importer.mockResolvedValueOnce({
      default: async (file) => {
        file.data += 'node_modules\n';
        return file;
      },
    });
    importer.mockResolvedValueOnce({
      default: async (file) => {
        file.data += 'coverage\n';
        return file;
      },
    });
    readFileAsync.mockResolvedValueOnce(Buffer.from('.git\n'));
    readFileAsync.mockResolvedValueOnce(Buffer.from('.git\n.lol\n'));
    writeFileAsync.mockResolvedValue(undefined);
    unlinkAsync.mockResolvedValue(undefined);
    glob.mockResolvedValueOnce(['_dot_gitignore']);
    mkdirpAsync.mockResolvedValue(undefined);
    glob.mockResolvedValueOnce([]);

    const { buildPackageAssets } = await $.run<{
      buildPackageAssets: BuildPackageAssetsService;
    }>(['buildPackageAssets']);
    const result = await buildPackageAssets(packageConf, {
      configsSequence: ['_common'],
      modulesSequence: ['metapak-module1', 'metapak-module2'],
      modulesConfigs: {
        'metapak-module1': {
          base: 'project/dir/node_modules/metapak-module1',
          srcDir: 'src',
          assetsDir: 'src',
          configs: ['_common'],
        },
        'metapak-module2': {
          base: 'project/dir/node_modules/metapak-module2',
          srcDir: 'src',
          assetsDir: 'src',
          configs: ['_common'],
        },
      },
    });

    expect({
      globCalls: glob.mock.calls,
      importerCalls: importer.mock.calls,
      readFileAsyncCalls: readFileAsync.mock.calls,
      mkdirpAsyncCalls: mkdirpAsync.mock.calls,
      writeFileAsyncCalls: writeFileAsync.mock.calls.map(bufferToText),
      unlinkAsyncCalls: unlinkAsync.mock.calls,
      logCalls: log.mock.calls.filter(filterLogs),
      result,
    }).toMatchInlineSnapshot(`
      {
        "globCalls": [
          [
            "**/*",
            {
              "cwd": "project/dir/node_modules/metapak-module1/src/_common/assets",
              "dot": true,
              "nodir": true,
            },
          ],
          [
            "**/*",
            {
              "cwd": "project/dir/node_modules/metapak-module2/src/_common/assets",
              "dot": true,
              "nodir": true,
            },
          ],
        ],
        "importerCalls": [
          [
            "project/dir/node_modules/metapak-module1/src/_common/assets.js",
          ],
          [
            "project/dir/node_modules/metapak-module2/src/_common/assets.js",
          ],
        ],
        "logCalls": [
          [
            "debug",
            "Processing asset:",
            "project/dir/node_modules/metapak-module1/src/_common/assets/_dot_gitignore",
          ],
          [
            "debug",
            "Saving asset:",
            "project/dir/.gitignore",
          ],
        ],
        "mkdirpAsyncCalls": [],
        "readFileAsyncCalls": [
          [
            "project/dir/node_modules/metapak-module1/src/_common/assets/_dot_gitignore",
          ],
          [
            "project/dir/.gitignore",
          ],
        ],
        "result": true,
        "unlinkAsyncCalls": [],
        "writeFileAsyncCalls": [
          [
            "project/dir/.gitignore",
            ".git
      node_modules
      coverage
      ",
            undefined,
          ],
        ],
      }
    `);
  });

  test('should work whith directories', async () => {
    const packageConf: MetapakPackageJson<JsonObject, JsonObject> = {
      metapak: {
        configs: ['_common'],
        data: {},
      },
    };

    importer.mockResolvedValue({
      default: async (file) => {
        file.data = '{\n  "private": false\n}';
        return file;
      },
    });
    readFileAsync.mockResolvedValueOnce(Buffer.from('{\n  "test": true\n}'));
    readFileAsync.mockResolvedValueOnce(Buffer.from('{\n  "private": true\n}'));
    writeFileAsync.mockResolvedValue(undefined);
    unlinkAsync.mockResolvedValue(undefined);
    mkdirpAsync.mockResolvedValue(undefined);
    glob.mockResolvedValue(['lol/wadup']);

    const { buildPackageAssets } = await $.run<{
      buildPackageAssets: BuildPackageAssetsService;
    }>(['buildPackageAssets']);
    const result = await buildPackageAssets(packageConf, {
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
      globCalls: glob.mock.calls,
      importerCalls: importer.mock.calls,
      readFileAsyncCalls: readFileAsync.mock.calls,
      mkdirpAsyncCalls: mkdirpAsync.mock.calls,
      writeFileAsyncCalls: writeFileAsync.mock.calls.map(bufferToText),
      unlinkAsyncCalls: unlinkAsync.mock.calls,
      logCalls: log.mock.calls.filter(filterLogs),
      result,
    }).toMatchInlineSnapshot(`
      {
        "globCalls": [
          [
            "**/*",
            {
              "cwd": "project/dir/node_modules/metapak-http-server/src/_common/assets",
              "dot": true,
              "nodir": true,
            },
          ],
        ],
        "importerCalls": [
          [
            "project/dir/node_modules/metapak-http-server/src/_common/assets.js",
          ],
        ],
        "logCalls": [
          [
            "debug",
            "Processing asset:",
            "project/dir/node_modules/metapak-http-server/src/_common/assets/lol/wadup",
          ],
          [
            "debug",
            "Saving asset:",
            "project/dir/lol/wadup",
          ],
        ],
        "mkdirpAsyncCalls": [
          [
            "project/dir/lol",
          ],
        ],
        "readFileAsyncCalls": [
          [
            "project/dir/node_modules/metapak-http-server/src/_common/assets/lol/wadup",
          ],
          [
            "project/dir/lol/wadup",
          ],
        ],
        "result": true,
        "unlinkAsyncCalls": [],
        "writeFileAsyncCalls": [
          [
            "project/dir/lol/wadup",
            "{
        "private": false
      }",
            undefined,
          ],
        ],
      }
    `);
  });

  test('should allow to rename assets with async transformers', async () => {
    const packageConf: MetapakPackageJson<JsonObject, JsonObject> = {
      metapak: {
        configs: ['_common'],
        data: {},
      },
    };

    importer.mockResolvedValue({
      default: async (file) => {
        file.name = 'notlol';
        file.data = '{\n  "private": false\n}';
        return Promise.resolve(file);
      },
    });
    readFileAsync.mockResolvedValueOnce(Buffer.from('{\n  "test": true\n}'));
    readFileAsync.mockResolvedValueOnce(Buffer.from('{\n  "private": true\n}'));
    writeFileAsync.mockResolvedValue(undefined);
    unlinkAsync.mockResolvedValue(undefined);
    mkdirpAsync.mockResolvedValue(undefined);
    glob.mockResolvedValue(['lol']);

    const { buildPackageAssets } = await $.run<{
      buildPackageAssets: BuildPackageAssetsService;
    }>(['buildPackageAssets']);
    const result = await buildPackageAssets(packageConf, {
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
      globCalls: glob.mock.calls,
      importerCalls: importer.mock.calls,
      readFileAsyncCalls: readFileAsync.mock.calls,
      mkdirpAsyncCalls: mkdirpAsync.mock.calls,
      writeFileAsyncCalls: writeFileAsync.mock.calls.map(bufferToText),
      unlinkAsyncCalls: unlinkAsync.mock.calls,
      logCalls: log.mock.calls.filter(filterLogs),
      result,
    }).toMatchInlineSnapshot(`
      {
        "globCalls": [
          [
            "**/*",
            {
              "cwd": "project/dir/node_modules/metapak-http-server/src/_common/assets",
              "dot": true,
              "nodir": true,
            },
          ],
        ],
        "importerCalls": [
          [
            "project/dir/node_modules/metapak-http-server/src/_common/assets.js",
          ],
        ],
        "logCalls": [
          [
            "debug",
            "Processing asset:",
            "project/dir/node_modules/metapak-http-server/src/_common/assets/lol",
          ],
          [
            "debug",
            "Saving asset:",
            "project/dir/notlol",
          ],
        ],
        "mkdirpAsyncCalls": [],
        "readFileAsyncCalls": [
          [
            "project/dir/node_modules/metapak-http-server/src/_common/assets/lol",
          ],
          [
            "project/dir/notlol",
          ],
        ],
        "result": true,
        "unlinkAsyncCalls": [],
        "writeFileAsyncCalls": [
          [
            "project/dir/notlol",
            "{
        "private": false
      }",
            undefined,
          ],
        ],
      }
    `);
  });

  test('should work when data did not change', async () => {
    const packageConf: MetapakPackageJson<JsonObject, JsonObject> = {
      metapak: {
        configs: ['_common'],
        data: {},
      },
    };

    importer.mockResolvedValue({
      default: async (file) => {
        file.data = '{\n  "private": true\n}';
        return file;
      },
    });
    readFileAsync.mockResolvedValueOnce(Buffer.from('{\n  "test": true\n}'));
    readFileAsync.mockResolvedValueOnce(Buffer.from('{\n  "private": true\n}'));
    writeFileAsync.mockResolvedValue(undefined);
    unlinkAsync.mockResolvedValue(undefined);
    mkdirpAsync.mockResolvedValue(undefined);
    glob.mockResolvedValue(['lol']);

    const { buildPackageAssets } = await $.run<{
      buildPackageAssets: BuildPackageAssetsService;
    }>(['buildPackageAssets']);
    const result = await buildPackageAssets(packageConf, {
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
      globCalls: glob.mock.calls,
      importerCalls: importer.mock.calls,
      readFileAsyncCalls: readFileAsync.mock.calls,
      mkdirpAsyncCalls: mkdirpAsync.mock.calls,
      writeFileAsyncCalls: writeFileAsync.mock.calls.map(bufferToText),
      unlinkAsyncCalls: unlinkAsync.mock.calls,
      logCalls: log.mock.calls.filter(filterLogs),
      result,
    }).toMatchInlineSnapshot(`
      {
        "globCalls": [
          [
            "**/*",
            {
              "cwd": "project/dir/node_modules/metapak-http-server/src/_common/assets",
              "dot": true,
              "nodir": true,
            },
          ],
        ],
        "importerCalls": [
          [
            "project/dir/node_modules/metapak-http-server/src/_common/assets.js",
          ],
        ],
        "logCalls": [
          [
            "debug",
            "Processing asset:",
            "project/dir/node_modules/metapak-http-server/src/_common/assets/lol",
          ],
        ],
        "mkdirpAsyncCalls": [],
        "readFileAsyncCalls": [
          [
            "project/dir/node_modules/metapak-http-server/src/_common/assets/lol",
          ],
          [
            "project/dir/lol",
          ],
        ],
        "result": false,
        "unlinkAsyncCalls": [],
        "writeFileAsyncCalls": [],
      }
    `);
  });

  test('should delete when data is empty', async () => {
    const packageConf: MetapakPackageJson<JsonObject, JsonObject> = {
      metapak: {
        configs: ['_common'],
        data: {},
      },
    };

    importer.mockResolvedValue({
      default: async (file) => {
        file.data = '';
        return file;
      },
    });
    readFileAsync.mockResolvedValueOnce(Buffer.from('{\n  "test": true\n}'));
    readFileAsync.mockResolvedValueOnce(Buffer.from('{\n  "private": true\n}'));
    writeFileAsync.mockResolvedValue(undefined);
    unlinkAsync.mockResolvedValue(undefined);
    mkdirpAsync.mockResolvedValue(undefined);
    glob.mockResolvedValue(['lol']);

    const { buildPackageAssets } = await $.run<{
      buildPackageAssets: BuildPackageAssetsService;
    }>(['buildPackageAssets']);
    const result = await buildPackageAssets(packageConf, {
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
      globCalls: glob.mock.calls,
      importerCalls: importer.mock.calls,
      readFileAsyncCalls: readFileAsync.mock.calls,
      mkdirpAsyncCalls: mkdirpAsync.mock.calls,
      writeFileAsyncCalls: writeFileAsync.mock.calls.map(bufferToText),
      unlinkAsyncCalls: unlinkAsync.mock.calls,
      logCalls: log.mock.calls.filter(filterLogs),
      result,
    }).toMatchInlineSnapshot(`
      {
        "globCalls": [
          [
            "**/*",
            {
              "cwd": "project/dir/node_modules/metapak-http-server/src/_common/assets",
              "dot": true,
              "nodir": true,
            },
          ],
        ],
        "importerCalls": [
          [
            "project/dir/node_modules/metapak-http-server/src/_common/assets.js",
          ],
        ],
        "logCalls": [
          [
            "debug",
            "Processing asset:",
            "project/dir/node_modules/metapak-http-server/src/_common/assets/lol",
          ],
          [
            "debug",
            "Deleting asset:",
            "project/dir/lol",
          ],
        ],
        "mkdirpAsyncCalls": [],
        "readFileAsyncCalls": [
          [
            "project/dir/node_modules/metapak-http-server/src/_common/assets/lol",
          ],
          [
            "project/dir/lol",
          ],
        ],
        "result": true,
        "unlinkAsyncCalls": [
          [
            "project/dir/lol",
          ],
        ],
        "writeFileAsyncCalls": [],
      }
    `);
  });

  test('should not delete when data is empty and file is already  deleted', async () => {
    const packageConf: MetapakPackageJson<JsonObject, JsonObject> = {
      metapak: {
        configs: ['_common'],
        data: {},
      },
    };

    importer.mockResolvedValue({
      default: async (file) => {
        file.data = '';
        return file;
      },
    });
    readFileAsync.mockResolvedValueOnce(Buffer.from('{\n  "test": true\n}'));
    readFileAsync.mockRejectedValueOnce(new Error('E_NOT_FOUND'));
    writeFileAsync.mockResolvedValue(undefined);
    unlinkAsync.mockResolvedValue(undefined);
    mkdirpAsync.mockResolvedValue(undefined);
    glob.mockResolvedValue(['lol']);

    const { buildPackageAssets } = await $.run<{
      buildPackageAssets: BuildPackageAssetsService;
    }>(['buildPackageAssets']);
    const result = await buildPackageAssets(packageConf, {
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
      globCalls: glob.mock.calls,
      importerCalls: importer.mock.calls,
      readFileAsyncCalls: readFileAsync.mock.calls,
      mkdirpAsyncCalls: mkdirpAsync.mock.calls,
      writeFileAsyncCalls: writeFileAsync.mock.calls.map(bufferToText),
      unlinkAsyncCalls: unlinkAsync.mock.calls,
      logCalls: log.mock.calls.filter(filterLogs),
      result,
    }).toMatchInlineSnapshot(`
      {
        "globCalls": [
          [
            "**/*",
            {
              "cwd": "project/dir/node_modules/metapak-http-server/src/_common/assets",
              "dot": true,
              "nodir": true,
            },
          ],
        ],
        "importerCalls": [
          [
            "project/dir/node_modules/metapak-http-server/src/_common/assets.js",
          ],
        ],
        "logCalls": [
          [
            "debug",
            "Processing asset:",
            "project/dir/node_modules/metapak-http-server/src/_common/assets/lol",
          ],
          [
            "debug",
            "Asset not found:",
            "project/dir/node_modules/metapak-http-server/src/_common/assets/lol",
          ],
        ],
        "mkdirpAsyncCalls": [],
        "readFileAsyncCalls": [
          [
            "project/dir/node_modules/metapak-http-server/src/_common/assets/lol",
          ],
          [
            "project/dir/lol",
          ],
        ],
        "result": false,
        "unlinkAsyncCalls": [],
        "writeFileAsyncCalls": [],
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
