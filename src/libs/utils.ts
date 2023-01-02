import chalk from 'chalk';
import { diffJson } from 'diff';
import type { JsonValue, JsonObject, PackageJson } from 'type-fest';

export type MetapakConfiguration<T = JsonObject> = {
  configs: string[];
  sequence?: string[];
  data: T;
};
export type MetapakPackageJson<T, U> = PackageJson & {
  metapak: MetapakConfiguration<T>;
} & U;
export type MetapakModuleConfigs = Record<
  string,
  {
    base: string;
    srcDir: string;
    assetsDir: string;
    configs: string[];
  }
>;
export type MetapakContext = {
  modulesConfigs: MetapakModuleConfigs;
  modulesSequence: string[];
  configsSequence: string[];
};
export type PackageJSONTransformer<T, U> = (
  packageJSON: MetapakPackageJson<T, U>,
) => MetapakPackageJson<T, U>;

export const identity = <T>(x: T): T => x;
export const identityAsync = async <T>(x: T): Promise<T> => x;

export async function mapConfigsSequentially<T>(
  metapakContext: MetapakContext,
  fn: (metapakModuleName: string, metapakModuleConfig: string) => Promise<T>,
): Promise<T[]> {
  const transformers: T[] = [];

  for (const configName of metapakContext.configsSequence) {
    for (const moduleName of metapakContext.modulesSequence) {
      const transformer = await fn(moduleName, configName);
      transformers.push(transformer);
    }
  }

  return transformers;
}

export function buildDiff(newData: JsonValue, originalData: JsonValue): string {
  return diffJson(originalData, newData, {})
    .map((part) =>
      (part.added ? chalk.green : part.removed ? chalk.red : chalk.grey)(
        part.value,
      ),
    )
    .join('');
}
