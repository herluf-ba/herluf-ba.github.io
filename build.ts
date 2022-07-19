import { Marked } from "https://deno.land/x/markdown@v2.0.0/mod.ts";
import * as path from "https://deno.land/std@0.148.0/path/mod.ts";
import { ensureFile } from "https://deno.land/std@0.54.0/fs/ensure_file.ts";

// TODO:
// - tag sub page
// - minimal SEO tags
// - convert images to webp via command
// - deploy to production branch

// NOTE: To build entire site run:
// deno run --allow-read --allow-write build.ts

// SETTINGS
const TEMPLATE_DIR = "templates";
const CONTENT_DIR = "content";
const OUT_DIR = "public";

type Parsed = {
  source: string;
  destination: string;
  href: string;
  public_path: string;
  content: string;
  meta: {
    title: string;
    summary: string;
    publishedAt: string;
    tags: ReadonlyArray<string>;
  };
};

// GLOBALS
const decoder = new TextDecoder("utf-8");
const encoder = new TextEncoder();
const TEMPLATES = {
  index: decoder.decode(
    await Deno.readFile(path.join(TEMPLATE_DIR, "index.html"))
  ),
  post: decoder.decode(
    await Deno.readFile(path.join(TEMPLATE_DIR, "post.html"))
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
  const text = decoder.decode(await Deno.readFile(source));
  const parsed = Marked.parse(text);
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

const render_tags = (tags: ReadonlyArray<string>) =>
  tags.map((tag) => `<a class="tag" href="/tag/${tag}">${tag}</a>`).join("\n");

const render_date = (date: string) =>
  `<span class="date">${new Date(date).toLocaleDateString("en-US")}</span>`;

const render = (template: string, parsed: Parsed) =>
  template
    .replaceAll("{{TITLE}}", parsed.meta.title)
    .replaceAll("{{CONTENT}}", parsed.content)
    .replaceAll("{{TAGS}}", render_tags(parsed.meta.tags))
    .replaceAll("{{PUBLIC}}", parsed.public_path);

const write = async (destination: string, html: string) => {
  await ensureFile(destination);
  await Deno.writeFile(destination, encoder.encode(html), {
    create: true,
  });
};

// Read and parse all posts in content folder
const markdown_files = await getNestedMdFiles(CONTENT_DIR);
const parsed_files = await Promise.all(markdown_files.map(parse));

// Render and save all posts
for await (const parsed of parsed_files) {
  const html = render(TEMPLATES["post"], parsed);
  await write(parsed.destination, html);
}

// Generate links for each post
const frontpage_content = `
<nav>
${parsed_files
  .map(
    (parsed) => `
    <section class="card">
      ${render_date(parsed.meta.publishedAt)}
      <a href="${parsed.href}"><h2>${parsed.meta.title}</h2></a>
      ${render_tags(parsed.meta.tags)}
    </section>`
  )
  .join("\n")}
</nav>
`;

const frontpage: Parsed = {
  source: ".",
  public_path: ".",
  href: "/",
  destination: "public/index.html",
  content: frontpage_content,
  meta: {
    title: "Herluf B",
    summary: "A blog about game development as a hobbyist",
    publishedAt: new Date().toISOString(),
    tags: [],
  },
};

await write(frontpage.destination, render(TEMPLATES["index"], frontpage));
