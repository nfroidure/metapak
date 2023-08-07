import { name, autoService } from 'knifecycle';
import { YError } from 'yerror';
import fs from 'fs';
import mkdirp from 'mkdirp';
import type { WriteFileOptions } from 'fs';
import type { LogService } from 'common-services';
import type { ProgramOptionsService } from './programOptions.js';

export type FSService = {
  mkdirpAsync: (path: string) => Promise<void>;
  readFileAsync: (path: string) => Promise<Buffer>;
  accessAsync: (path: string) => Promise<void>;
  readdirAsync: (path: string) => Promise<string[]>;
  unlinkAsync: (path: string) => Promise<void>;
  writeFileAsync: (
    path: string,
    data: Buffer,
    options?: WriteFileOptions,
  ) => Promise<void>;
  constants: typeof fs.constants;
};

async function initFS({
  programOptions,
  log,
}: {
  programOptions: ProgramOptionsService;
  log: LogService;
}): Promise<FSService> {
  return {
    mkdirpAsync: async (path: string) => {
      if (programOptions.dryRun) {
        log('warning', '📂 - Create a folder:', path);
        return;
      }
      await mkdirp(path, {
        fs: {
          mkdir: ((
            ...args: [
              path: string,
              callback: (
                err: NodeJS.ErrnoException | null,
                path?: string,
              ) => void,
            ]
          ) => {
            if (programOptions.safe) {
              throw new YError('E_UNEXPECTED_CHANGES', args[0]);
            }
            fs.mkdir(...args);
          }) as typeof fs.mkdir,
          stat: fs.stat,
        },
      });
    },
    readFileAsync: fs.promises.readFile,
    accessAsync: fs.promises.access,
    readdirAsync: fs.promises.readdir,
    unlinkAsync: async (path) => {
      if (programOptions.dryRun) {
        log('warning', '⌫ - Delete a file:', path);
        return;
      }
      if (programOptions.safe) {
        throw new YError('E_UNEXPECTED_CHANGES', path);
      }
      await fs.promises.unlink(path);
    },
    writeFileAsync: async (path: string, data: Buffer) => {
      if (programOptions.dryRun) {
        log('warning', '💾 - Modify a file:', path);
        return;
      }
      if (programOptions.safe) {
        throw new YError('E_UNEXPECTED_CHANGES', path);
      }
      await fs.promises.writeFile(path, data);
    },
    constants: fs.constants,
  };
}

export default name('fs', autoService(initFS));
