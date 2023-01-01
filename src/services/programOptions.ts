import fs from 'fs';
import path from 'path';
import { program } from 'commander';
import { autoService } from 'knifecycle';

export type ProgramOptionsService = {
  safe?: boolean;
  dryRun?: boolean;
  base: string;
};

async function initProgramOptions(): Promise<ProgramOptionsService> {
  return program
    .version(
      JSON.parse(fs.readFileSync(path.join('.', 'package.json')).toString()),
    )
    .option('-s, --safe', 'Exit with 1 when changes are detected')
    .option('-d, --dry-run', 'Print the changes without doing it')
    .option('-b, --base [value]', 'Base for links')
    .parse(process.argv)
    .opts();
}

export default autoService(initProgramOptions);
