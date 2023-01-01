import chalk from 'chalk';
import { diffJson } from 'diff';
import type { JsonValue, JsonObject } from 'type-fest';

export type PackageJSONTransformer = (packageJSON: JsonObject) => JsonObject;

export const identity = (x) => x;

export async function mapConfigsSequentially<T>(
  metapakModulesSequence: string[],
  metapakModulesConfigs: Record<string, string[]>,
  fn: (metapakModuleName: string, metapakModuleConfig: string) => Promise<T>,
): Promise<T[]> {
  const packageTransformers = await Promise.all(
    metapakModulesSequence.map((metapakModuleName) =>
      Promise.all(
        metapakModulesConfigs[metapakModuleName].map((metapakModuleConfig) =>
          fn(metapakModuleName, metapakModuleConfig),
        ),
      ),
    ),
  );

  return packageTransformers.reduce(
    (combined, packageTransformer) => combined.concat(packageTransformer),
    [],
  );
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
