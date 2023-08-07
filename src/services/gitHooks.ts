import path from 'path';
import { autoService } from 'knifecycle';
import { mapConfigsSequentially, identity } from '../libs/utils.js';
import { printStackTrace } from 'yerror';
import type { MetapakPackageJson, MetapakContext } from '../libs/utils.js';
import type { FSService } from './fs.js';
import type { ImporterService, LogService } from 'common-services';

export default autoService(initBuildPackageGitHooks);

export type HooksHash = Partial<
  Record<
    | 'applypatch-msg'
    | 'post-update'
    | 'pre-commit'
    | 'pre-rebase'
    | 'commit-msg'
    | 'pre-applypatch'
    | 'prepare-commit-msg'
    | 'update'
    | 'commit-msg'
    | 'pre-commit'
    | 'pre-push',
    string[]
  >
>;
export type GitHooksTransformer<T, U> = (
  hooks: HooksHash,
  packageConf: MetapakPackageJson<T, U>,
) => HooksHash;
export type BuildPackageGitHooksService = (
  packageConf: MetapakPackageJson<unknown, unknown>,
  metapakContext: MetapakContext,
) => Promise<void>;

async function initBuildPackageGitHooks({
  ENV,
  PROJECT_DIR,
  GIT_HOOKS_DIR,
  fs,
  EOL,
  log,
  importer,
}: {
  ENV: Record<string, string>;
  PROJECT_DIR: string;
  GIT_HOOKS_DIR: string;
  fs: FSService;
  EOL: string;
  log: LogService;
  importer: ImporterService<{ default: GitHooksTransformer<unknown, unknown> }>;
}): Promise<BuildPackageGitHooksService> {
  return async (
    packageConf: MetapakPackageJson<unknown, unknown>,
    metapakContext: MetapakContext,
  ): Promise<void> => {
    // Avoiding CI since it does not make sense
    if (ENV.CI) {
      return;
    }

    // Avoid adding hooks for package that ain't at the git
    // root directory
    if (path.relative(PROJECT_DIR, GIT_HOOKS_DIR).startsWith('..')) {
      return;
    }

    const hooksBuilders = await mapConfigsSequentially(
      metapakContext,
      async (
        metapakModuleName: string,
        metapakConfigName: string,
      ): Promise<GitHooksTransformer<unknown, unknown>> => {
        const packageHooksPath = path.join(
          metapakContext.modulesConfigs[metapakModuleName].base,
          metapakContext.modulesConfigs[metapakModuleName].srcDir,
          metapakConfigName,
          'hooks.js',
        );
        try {
          return (await importer(packageHooksPath)).default;
        } catch (err) {
          log('debug', '🤷 - No hooks found at:', packageHooksPath);
          log('debug-stack', printStackTrace(err));
        }
        return identity as GitHooksTransformer<unknown, unknown>;
      },
    );
    const hooks = await hooksBuilders.reduce(
      (hooks, hooksBuilder) => hooksBuilder(hooks, packageConf),
      {} as HooksHash,
    );

    await Promise.all(
      Object.keys(hooks).map(async (hookName) => {
        const hookContent =
          '#!/bin/sh' +
          EOL +
          '# Automagically generated by metapak, do not change in place.' +
          EOL +
          '# Your changes would be loose on the next npm install run.' +
          EOL +
          hooks[hookName].join(';' + EOL);
        const hookPath = path.join(GIT_HOOKS_DIR, hookName);

        let currentHookContent = '';

        try {
          currentHookContent = (await fs.readFileAsync(hookPath)).toString();
        } catch (err) {
          log('debug', '🤷 - No existing hook found:', hookPath);
          log('debug-stack', printStackTrace(err));
        }
        if (currentHookContent !== hookContent) {
          await fs.writeFileAsync(hookPath, Buffer.from(hookContent), {
            mode: 0o777,
          });
        }
      }),
    );
  };
}
