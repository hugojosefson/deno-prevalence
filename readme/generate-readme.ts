#!/usr/bin/env -S deno run --allow-read=.
import {
  dirname,
  relative,
  resolve,
} from "https://deno.land/std@0.190.0/path/mod.ts";

const PROJECT_ROOT = (new URL("../", import.meta.url)).pathname;

/**
 * This program generates the README.md for the root directory.
 *
 * It reads from the file referred to by this program's first argument, and writes to stdout.
 *
 * Based on what it sees when it reads from the file, it may also read files from
 * the filesystem.
 *
 * It reads text, and writes text. The only syntax it understands is the
 * following directives:
 * - Any line that includes the text `@@include(filename)` will be replaced
 *   with the contents of the file, relative to the currently parsed file. The
 *   whole line will be replaced.
 * - Any shebang line at the start of any input file, will be removed.
 * - For any word that starts with `./` or `../` and where that word refers to
 *   a file that exists, the word will be replaced with a relative path from
 *   the root of the git repo, and prefixed with `https://deno.land/x/prevalence/`.
 * - Characters that are not part of a word, and thus can be seen as surrounding a file path, are:
 *   - any whitespace
 *   - any of `(){}[]<>`
 *   - any of `#"'`
 *   - any of `,;:`
 * - The resulting text will be written to stdout.
 */
async function main() {
  const inputFilePath =
    (new URL(Deno.args[0], `file://${Deno.cwd()}/`)).pathname;
  const inputText = await Deno.readTextFile(inputFilePath);
  const outputText = await processText(inputText, inputFilePath);
  console.log(outputText);
}

async function processText(
  inputText: string,
  inputFilePath: string,
): Promise<string> {
  const lines = inputText.split("\n");
  // skip any first line with shebang
  if (lines[0]?.startsWith("#!")) {
    lines.shift();
  }
  const forInclude = processLineForInclude(inputFilePath);
  const forFileReference = processLineForFileReference(inputFilePath);
  return (await Promise.all(lines.map(
    async function (line: string) {
      const lines1: string[] = (await forInclude(line)).split("\n");
      const lines2: string[] = lines1.map(forFileReference);
      return lines2.join("\n");
    },
  ))).join("\n");
}

function processLineForInclude(
  inputFilePath: string,
): (line: string) => Promise<string> {
  return async (line: string): Promise<string> => {
    const match = line.match(/@@include\((.*)\)/);
    if (match) {
      const matchedPath = match[1];
      const includeFilePath = resolve(dirname(inputFilePath), matchedPath);
      const resolvedIncludeFilePath = await Deno.realPath(includeFilePath);
      return await processText(
        await Deno.readTextFile(resolvedIncludeFilePath),
        resolvedIncludeFilePath,
      );
    }
    return line;
  };
}

const REGEX_FOR_RELATIVE_PATH_TO_FILE =
  /(?<all>(?:^|[\s(){}\[\]<>#'",;])(?<foundFilePath>\.\.?\/[^\s(){}\[\]<>#'",;]+)(?:[\s(){}\[\]<>#'",;]|$))/;

function processLineForFileReference(
  inputFilePath: string,
): (line: string) => string {
  return (line: string): string => {
    const match = line.match(REGEX_FOR_RELATIVE_PATH_TO_FILE);
    if (match?.groups) {
      console.error(`match = ${JSON.stringify(match, null, 2)}`);
      const {all, foundFilePath} = match.groups;
      const step1: string =
        (new URL(foundFilePath, `file://${inputFilePath}`)).pathname;
      try {
        Deno.lstatSync(step1);
      } catch (err) {
        if (err instanceof Deno.errors.NotFound) {
          return line;
        }
        throw err;
      }
      const relativeFromProjectRoot: string = relative(PROJECT_ROOT, step1);
      return line.replace(
        foundFilePath,
        `https://deno.land/x/prevalence/${relativeFromProjectRoot}`,
      );
    }
    return line;
  };
}

if (import.meta.main) {
  await main();
}
