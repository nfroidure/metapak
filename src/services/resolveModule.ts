import { YError } from 'yerror';
import path from 'path';
import { autoService } from 'knifecycle';
import type { ResolveService } from 'common-services';
import type { MetapakPackageJson } from './packageConf.js';

export type ResolveModuleService = (
  metapakModuleName: string,
  packageConf: MetapakPackageJson,
) => string;

export default autoService(initResolveModule);

async function initResolveModule({
  PROJECT_DIR,
  resolve,
}: {
  PROJECT_DIR: string;
  resolve: ResolveService;
}): Promise<ResolveModuleService> {
  return function resolveModule(metapakModuleName, packageConf) {
    try {
      // Cover the case a metapak plugin runs itself
      if (metapakModuleName === packageConf.name) {
        return path.dirname(resolve(`${PROJECT_DIR}/package`));
      }
      return path.dirname(resolve(`${metapakModuleName}/package`));
    } catch (err) {
      throw YError.wrap(err as Error, 'E_MODULE_NOT_FOUND', metapakModuleName);
    }
  };
}
