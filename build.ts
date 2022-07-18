import { Marked } from "https://deno.land/x/markdown@v2.0.0/mod.ts";
import * as path from "https://deno.land/std@0.148.0/path/mod.ts";
import { ensureFile } from "https://deno.land/std@0.54.0/fs/ensure_file.ts";

// NOTE: To build entire site run:
// deno run --allow-read --allow-write build.ts

type Parsed = {
  source: string;
  destination: string;
  href: string;
  public_path: string;
  content: string;
  meta: {
    title: string;
    summary: string;
    tags: ReadonlyArray<string>;
  };
};

const TEMPLATE_DIR = "templates";
const CONTENT_DIR = "content";
const OUT_DIR = "public";

const decoder = new TextDecoder("utf-8");
const encoder = new TextEncoder();

const TEMPLATES = {
  default: decoder.decode(
    await Deno.readFile(path.join(TEMPLATE_DIR, "default.html"))
  ),
};

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

const parse = async (source: string): Promise<Parsed> => {
  const parsed = Marked.parse(decoder.decode(await Deno.readFile(source)));
  const source_path = path.parse(source);
  const destination = path.join(
    source_path.dir.replace(CONTENT_DIR, OUT_DIR),
    source_path.name + ".html"
  );
  const href = path.join(
    source_path.dir.replace(CONTENT_DIR, ""),
    source_path.name + ".html"
  );

  const public_path = path.join(
    ...Array((destination.match(/\//g)?.length ?? 0) - 1).fill("..")
  );

  return {
    public_path,
    destination,
    source,
    href,
    ...parsed,
  } as Parsed;
};

const render = (parsed: Parsed) => {
  const template = TEMPLATES["default"];
  console.log(parsed);
  return template
    .replace("{{TITLE}}", parsed.meta.title)
    .replace("{{CONTENT}}", parsed.content)
    .replaceAll("{{PUBLIC}}", parsed.public_path);
};

const write = async (parsed: Parsed) => {
  await ensureFile(parsed.destination);
  await Deno.writeFile(parsed.destination, encoder.encode(render(parsed)), {
    create: true,
  });
};

const markdown_files = await getNestedMdFiles(CONTENT_DIR);
const parsed_files = await Promise.all(markdown_files.map(parse));
await Promise.all(parsed_files.map(write));

const tags = Array.from(new Set(parsed_files.flatMap(({ meta }) => meta.tags)));
console.log(tags);
