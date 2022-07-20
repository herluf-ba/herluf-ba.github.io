import { Marked } from "https://deno.land/x/markdown@v2.0.0/mod.ts";
import * as path from "https://deno.land/std@0.148.0/path/mod.ts";
import { ensureFile } from "https://deno.land/std@0.54.0/fs/ensure_file.ts";

// TODO:
// - Favicon
// - robots file
// - minimal SEO tags
// - convert images to webp via command
// - deploy to production branch
// - write blogpost

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
    image?: string;
    summary?: string;
    publishedAt?: string;
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
  tag: decoder.decode(await Deno.readFile(path.join(TEMPLATE_DIR, "tag.html"))),
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
  tags
    .map((tag) => `<a class="tag" href="/tag/${tag}.html">${tag}</a>`)
    .join("\n");

const render_date = (date?: string) =>
  date === undefined
    ? ""
    : `<span class="date">${new Date(date).toLocaleDateString("en-US")}</span>`;

const render_post_card = (parsed: Parsed) => `
<section class="card">
  ${render_date(parsed.meta.publishedAt)}
  <a href="/${parsed.href}"><h2>${parsed.meta.title}</h2></a>
  ${render_tags(parsed.meta.tags)}
</section>`;

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
  await write(parsed.destination, render(TEMPLATES["post"], parsed));
}

// Render and save a page for each tag with only posts that contain that tag
const tags = Array.from(new Set(parsed_files.flatMap(({ meta }) => meta.tags)));
for await (const tag of tags) {
  const posts_with_tag = parsed_files.filter(({ meta }) =>
    meta.tags.includes(tag)
  );

  await write(
    `public/tag/${tag}.html`,
    render(TEMPLATES["tag"], {
      source: ".",
      public_path: "..",
      href: `/tag/${tag}`,
      destination: `public/tags/${tag}.html`,
      content: `
    <nav>
      ${posts_with_tag.map(render_post_card).join("\n")}
    </nav>`,
      meta: {
        title: `Posts about ${tag}`,
        tags: [tag],
      },
    })
  );
}

// Render and save a frontpage
await write(
  "public/index.html",
  render(TEMPLATES["index"], {
    source: ".",
    public_path: ".",
    href: "/",
    destination: "public/index.html",
    content: `
  <nav>
    ${parsed_files.map(render_post_card).join("\n")}
  </nav>`,
    meta: {
      title: "Herluf B",
      summary: "A blog about game development as a hobbyist",
      publishedAt: new Date().toISOString(),
      tags: [],
    },
  })
);
