---
title : Writing a static site generator in a single file
description : Writing a pragmatic static site generator using deno, typescript and markdown files
publishedAt: '2022-07-20T12:00:00Z'
tags: 
  - deno
  - webdev
  - typescript
---
Since I decided to try to write [my own blog](https://herluf-ba.github.io), I have been looking around for a Static Site Generator (SSG). What I wanted was a pragmatic setup, that just maps markdown files to HTML.

I looked up Static Site Generators such as [Jekyll](https://jekyllrb.com/), [Hugo](https://gohugo.io/), [Gatsby](https://www.gatsbyjs.com/), [Eleventy](https://www.11ty.dev/) and a bunch more. Truth is any one of these would meet my needs, but I still had this itch that these frameworks were overkill for my use case. I would be better off with something smaller. 

So as a fun project I decided to write my own SSG. As a challenge, I wanted to see if I could do it in just one single file. 

Here's how I did it 🎉

## How to plan a site generator
At its core, a Static Site Generator **eats some content data and spits out some HTML file(s)**. In my case, the "content data" is markdown files. Here's [the one for this post](https://github.com/herluf-ba/herluf-ba.github.io/edit/main/content/writing-a-static-site-generator-in-a-single-file.md). This along with the HTML template is everything I want to feed my SSG, and then just have it spit out an HTML file for each post.

Besides the actual content data, I also want to add some common styling and some meta tags to each post. For that I'm going to use these very simple HTML templates:
```html
<!-- HTML template for a post -->
<!DOCTYPE html>
<html lang="en">
  <head>
    <!-- ...generic meta stuff, loading some fonts etc. -->
    <link rel="stylesheet" href="{{PUBLIC}}/assets/styles.css" />
    {{META}}
  </head>
  <body>
    <header>
      <a href="/">{HB}</a>
      <a aria-label="Github" href="https://github.com/herluf-ba">
        <!-- Inline SVG for github logo -->
      </a>
    </header>
    <main>
      <h1>{{TITLE}}</h1>
      <!-- Tags like these are ment to be replaced in the build script we are writing -->
      {{CONTENT}}
    </main>
  </body>
</html>
```

In the build script I wrote these TODO's to try and split up the site generation into its logical parts:
```typescript
// 1. Read all markdown files in a target folder
// 2. Parse each markdown file 
// 3. Insert parsed markdown into a HTML template
// 4. Write the generated HTML into files in public folder
```
With that, I'm ready to get codin' 💻

## Writing a generator script using Deno
I'm writing this generator script in typescript and I have found that the easiest way to run some typescript is to use [Deno](https://deno.land/). You literally install a single binary and you're are good to go. On my mac, all I have to do is:
```bash
brew install deno
deno run my_typescript.ts
```

With Deno installed I can get working on reading markdown files from a folder. This one is fairly simple using the Deno standard library (this post is turning into a Deno ad at this point 🦕)
```typescript
// Run with: deno run --allow-read build.ts
import * as path from "https://deno.land/std@0.148.0/path/mod.ts";

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

const parse = async (source: string): Promise<string> => {
 const text = decoder.decode(await Deno.readFile(source));
 // TODO: actually parse 'text'
 return text;
}

const markdown_files = await getNestedMdFiles(CONTENT_DIR);
const parsed_files = await Promise.all(markdown_files.map(parse));
```

## Parsing Markdown
To turn markdown into HTML is a two-step process. First, the markdown needs to be parsed into a data structure that can be manipulated. Then it can be translated to HTML. 

I will be using the aptly named [markdown](https://deno.land/x/markdown@v2.0.0) package to do both of these in one fell swoop. I like it for my project because it has a fairly simple interface and seems to produce nice HTML. I will, however, write my code such that it's easy to rip out the package later, should our relationship sour in the future.
```typescript
import { Marked } from "https://deno.land/x/markdown@v2.0.0/mod.ts";

const CONTENT_DIR = "content";
const OUT_DIR = "public"; 

// getNestedMdFiles...

type Page = {
  // These paths are used in just a bit when I get to page generation
  href: string;
  destination: string;
  public_path: string;
  // The actual HTML content
  content: string;
  // A meta object produced from the _frontmatter_ 
  // located at the top of the markdown file written in YML format.
  // This is used for stuff like seo descriptions and tags
  meta: {
    title: string;
  };
};

const parse = async (source: string): Promise<Page> => {
  const text = decoder.decode(await Deno.readFile(source));
  const parsed = Marked.parse(text);

  const nesting_level = (destination.match(/\//g)?.length ?? 0) - 1;
  const public_path = path.join(...Array(nesting_level).fill(".."));
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

  return {
    href,
    public_path
    destination,
    ...parsed,
  };
};

// Parse all files like this
const markdown_files = await getNestedMdFiles(CONTENT_DIR);
const parsed_files = await Promise.all(markdown_files.map(parse));
```

## Generatin' me some HTML files
With the parsed markdown ready to go it's finally time to do the G part for SSG! Actually, this step is the simplest of them all. I'll just write a dead simple render function and pass each Page object along with the HTML template to it.

```typescript
const SITE_ROOT = "herluf-ba.github.io";
const TEMPLATE_DIR = "templates";
const CONTENT_DIR = "content";
const OUT_DIR = "public"; 

const decoder = new TextDecoder("utf-8");
const encoder = new TextEncoder();

// Global object that holds all templates. For now theres just the one
const TEMPLATES = {
  post: decoder.decode(
    await Deno.readFile(path.join(TEMPLATE_DIR, "post.html"))
  ),
};

// getNestedMdFiles, Page, parse...

const render = (template: string, parsed: Page) =>
  template
    .replaceAll("{{TITLE}}", parsed.meta.title)
    .replaceAll("{{CONTENT}}", parsed.content)
    .replaceAll("{{PUBLIC}}", parsed.public_path);

const write = async (destination: string, html: string) => {
  await ensureFile(destination);
  await Deno.writeFile(destination, encoder.encode(html), {
    create: true,
  });
};

const markdown_files = await getNestedMdFiles(CONTENT_DIR);
const parsed_files = await Promise.all(markdown_files.map(parse));

// Generate all files like this
for await (const parsed of parsed_files) {
  const rendered_post = render(TEMPLATES["post"], parsed)
  await write(parsed.destination, rendered_post);
}
```
Now the build script can transform markdown posts into static HTML files 🎉

## Additional features
There are still some features that I didn't mention in this post that I ended up implementing too. These are:
- Generating an index page that lists all posts
- A tagging system for adding posts to categories
- Some basic meta-data for SEO-tags

You can read the final [build script here](https://github.com/herluf-ba/herluf-ba.github.io/blob/main/build.ts). It came out just under 200 lines ✨ 

I was glad to realize that it wasn't difficult to build on top of the features I already had. For instance, this is how I generate the front page:
```typescript
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
``` 

Thanks for reading!
