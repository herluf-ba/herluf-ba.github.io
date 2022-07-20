---
title : Writing a static site generator in a single file
description : Writing a pragmatic static site generator using deno, typescript and markdown files
publishedAt: '2022-07-20T12:00:00Z'
tags: 
  - deno
  - webdev
  - typescript
---
Since I decided to try to do [this blog](herluf-ba.github.io), I have been looking around for a Static Site Generator (SSG) that does what I want. Just a simple setup, that maps markdown files to HTML. I looked at [Jekyll](https://jekyllrb.com/), [Hugo](https://gohugo.io/), [Gatsby](https://www.gatsbyjs.com/), [Eleventy](https://www.11ty.dev/) and a bunch more. Thruth is any one of these would meet my needs, but I still had this itch that these frameworks were overkill for my usecase, that I would be better off with something smaller. So as a fun project I decided to write my own 🎉.

## Trying to be pragmatic
Maybe I read too much [unixsheikh](https://unixsheikh.com/articles/using-a-framework-can-make-you-stupid.html) but lately I've been almost agressively trying to keep my code as pragmatic as possible. That means as little external packages as possible, but also as few requirements as possible. In the case of this site I wanted to:
```markdown
- Write posts in markdown format and have them turn into nice HTML.
- Be able to add images and code snippets to posts
- Generate an 'index' page that displays all posts, sorted by publish date
- Have a 'green score' on lighthouse
```

## Planning the site generator
At its core a Static Site Generator **eats some content data and spits out some html file(s)**. In my case the "content data" is markdown files. As an example here's [the one for this post](https://github.com/herluf-ba/herluf-ba.github.io/blob/8a93a7e17596896b232dd9465ff09cf4c293a9cb/content/writing-a-static-site-generator-in-a-single-file.md). 
So my initial plan is to:
```typescript
// 1. Read all markdown files in a target folder
// 2. Parse each file
// 3. Transform each file into HTML
// 4. Write the generated HTML into files in another folder
```
I also want to add some common styling and some meta tags to each post. For that I'm going to use some very simple HTML templates. These almost speak for themselves:
```html
<!-- Here's the HTML template for a post -->
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
So I'll revise the plan:
```typescript
// 1. Read all markdown files in a target folder
// 2. Parse each markdown file 
// 3. Insert parsed markdown into a HTML template
// 4. Write the generated HTML into files in another folder
```
And I'll also need some index page where I can list all posts. This one uses another template, which you can [find here](https://github.com/herluf-ba/herluf-ba.github.io/blob/main/templates/index.html). The final plan is this:
```typescript
// 1. Read all markdown files in a target folder
// 2. Parse each markdown file 
// 3. Insert parsed markdown into a HTML template
// 4. Write the generated HTML into files in public folder
// 5. Generate an index page and write to public folder
```

I'll admit that the title of this post seems a bit misleading at this point. There is of course more than one file used on this site, but the [build script](https://github.com/herluf-ba/herluf-ba.github.io/blob/main/build.ts) *is* a single file 🤷‍♂️

## Writing some code
I'm writing this generator script in typescript and I have found that the easiest way to run some typescript is to use [Deno](https://deno.land/). You litteraly install a single binary and your are good to go. On my mac all I have to do is:
```bash
brew install deno
deno run my_typescript.ts
```

With Deno installed I can get working on `// 1. Read all markdown files in a target folder`. This one is fairly simple using the Deno standard library (this is turning into a Deno add at this point 🦕)
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
 // TODO: Parse text
 return text;
}

const markdown_files = await getNestedMdFiles(CONTENT_DIR);
const parsed_files = await Promise.all(markdown_files.map(parse));
```

## Parsing Markdown

