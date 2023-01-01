import { packageDirectory } from 'pkg-dir';
import { autoService } from 'knifecycle';
import { YError } from 'yerror';
import type { LogService } from 'common-services';

async function initProjectDir({ log }: { log: LogService }) {
  const projectDir = await packageDirectory();

  if (projectDir) {
    log('debug', '💡 - Found the project dir:', projectDir);
    return projectDir;
  }

  log(
    'error',
    '❌ - Project dir does not exist, are you sure you ran metapak inside a Node project?',
  );
  throw new YError('E_NO_PROJECT_DIR');
}

export default autoService(initProjectDir);
