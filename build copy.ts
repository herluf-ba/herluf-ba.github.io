import * as path from "https://deno.land/std@0.148.0/path/mod.ts";

// To build entire site run:
// deno run --allow-read build.ts

const CONTENT_DIR = "content";

const decoder = new TextDecoder("utf-8");

const getNestedMdFiles = async (
  dir: string
): Promise<ReadonlyArray<string>> => {
  const files = [];
  for await (const entry of Deno.readDir(dir)) {
    if (entry.isFile && entry.name.endsWith(".md")) {
      files.push(path.join(dir, entry.name));
    }
    if (entry.isDirectory) {
      files.push(...(await getNestedMdFiles(path.join(dir, entry.name))));
    }
  }

  return files;
};

const parse = async (source: string): Promise<string> =>
  decoder.decode(await Deno.readFile(source));

const markdown_files = await getNestedMdFiles(CONTENT_DIR);
const parsed_files = await Promise.all(markdown_files.map(parse));
