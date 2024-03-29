import { Marked } from "https://deno.land/x/markdown@v2.0.0/mod.ts";
import * as path from "https://deno.land/std@0.148.0/path/mod.ts";
import { ensureFile } from "https://deno.land/std@0.54.0/fs/ensure_file.ts";

// NOTE: To build entire site run:
// deno run --allow-read --allow-write build.ts
// To compress images run:
// for file in ${OUT_DIR}/images/*; do bin/cwebp "$file" -o "${file%.*}.webp"; done
// for file in docs/images/*; do bin/cwebp "$file" -o "${file%.*}.webp"; done

///////// SETTINGS /////////
const SITE_ROOT = "herluf-ba.github.io";
const TEMPLATE_DIR = "templates";
const CONTENT_DIR = "content";
const OUT_DIR = "docs"; // Github pages likes /docs rather than /public 🤷‍♂️

type Page = {
  href: string;
  destination: string;
  public_path: string;

  content: string;
  meta: {
    title: string;
    image?: string;
    description: string;
    publishedAt: string;
    tags: ReadonlyArray<string>;
  };
};

///////// GLOBALS /////////
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

///////// FILE IO /////////
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

const parse = async (source: string): Promise<Page> => {
  const text = decoder.decode(await Deno.readFile(source));
  const parsed = Marked.parse(text);
  const source_path = path.parse(source);
  const destination = path.join(
    source_path.dir.replace(CONTENT_DIR, OUT_DIR),
    source_path.name + ".html"
  );
  const href =
    "/" +
    path.join(
      source_path.dir.replace(CONTENT_DIR, ""),
      source_path.name + ".html"
    );

  const nesting_level = (destination.match(/\//g)?.length ?? 0) - 1;
  const public_path = path.join(...Array(nesting_level).fill(".."));

  return {
    href,
    public_path,
    destination,
    ...parsed,
  } as Page;
};

const write = async (destination: string, html: string) => {
  await ensureFile(destination);
  await Deno.writeFile(destination, encoder.encode(html), {
    create: true,
  });
};

///////// RENDERING /////////
const render_tags = (tags: ReadonlyArray<string>) =>
  tags
    .map((tag) => `<a class="tag" href="/tag/${tag}.html">${tag}</a>`)
    .join("\n");

const render_date = (date?: string) =>
  date === undefined
    ? ""
    : `<span class="date">${new Date(date).toLocaleDateString("en-US")}</span>`;

const render_post_card = (parsed: Page) => `
<section class="card">
  ${render_date(parsed.meta.publishedAt)}
  <a href="${parsed.href}"><h2>${parsed.meta.title}</h2></a>
  ${render_tags(parsed.meta.tags)}
</section>`;

const render_meta = (parsed: Page) => `
<title>${parsed.meta.title}</title>
<meta name="title" content="${parsed.meta.title}">
<meta name="description" content="${parsed.meta.description}">
<meta property="og:type" content="website">
<meta property="og:url" content="${SITE_ROOT}${parsed.href ?? ""}">
<meta property="og:title" content="${parsed.meta.title}">
<meta property="og:description" content="${parsed.meta.description}">
<meta property="og:image" content="${
  parsed.meta.image ?? "/images/herluf.webp"
}">
<meta property="twitter:card" content="description_large_image">
<meta property="twitter:url" content="${SITE_ROOT}${parsed.href ?? ""}">
<meta property="twitter:title" content="${parsed.meta.title}">
<meta property="twitter:description" content="${parsed.meta.description}">
<meta property="twitter:image" content="${
  parsed.meta.image ?? "/images/herluf.webp"
}">
`;

const render = (template: string, parsed: Page) =>
  template
    .replaceAll("{{META}}", render_meta(parsed))
    .replaceAll("{{TITLE}}", parsed.meta.title)
    .replaceAll("{{TAGS}}", render_tags(parsed.meta.tags))
    .replaceAll("{{PUBLIC}}", parsed.public_path)
    .replaceAll("{{CONTENT}}", parsed.content);

///////// SITE GENERATION /////////
// Read and parse all posts in content folder
const markdown_files = await getNestedMdFiles(CONTENT_DIR);
const parsed_files = (await Promise.all(markdown_files.map(parse))).sort(
  (a, b) => b.meta.publishedAt?.localeCompare(a.meta.publishedAt)
);

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

  const tag_page = render(TEMPLATES["tag"], {
    href: `/tag/${tag}`,
    public_path: "..",
    destination: `${OUT_DIR}/tags/${tag}.html`,
    content: `
  <nav>
    ${posts_with_tag.map(render_post_card).join("\n")}
  </nav>`,
    meta: {
      title: `Posts about ${tag}`,
      description: `Everything I have writting abount ${tag}`,
      publishedAt: new Date().toISOString(),
      tags: [tag],
    },
  });

  await write(`${OUT_DIR}/tag/${tag}.html`, tag_page);
}

// Render and save a frontpage
const front_page = render(TEMPLATES["index"], {
  href: "/",
  public_path: ".",
  destination: "${OUT_DIR}/index.html",
  content: `
<nav>
  ${parsed_files.map(render_post_card).join("\n")}
</nav>`,
  meta: {
    title: "Herluf B.",
    description:
      "👋 Hi there! I'm Herluf. I work as a web dev and write games for a hobby. Sometimes I write stuff and you can read that stuff right here",
    publishedAt: new Date().toISOString(),
    tags: [],
  },
});
await write(`${OUT_DIR}/index.html`, front_page);
