---
title : Writing a static site generator shouldn't be that hard
summary : An article about how actually avoiding overcomplication can make for better solutions
publishedAt: '2022-07-19T12:33:56Z'
tags: 
  - web-dev
  - web-dev
  - web-dev
  - web-dev
---
I work in web development. Recently I've found myself becoming increasingly frustrated with *overcomplication*. So many of the challenges I have to face at work stem from an increasingly complex setup that in the end comes together to produce a pretty standard website. So, half as a fun side-project and half out of spite, I'm writing a static site generator to illustrate what I consider a more pragmatic approach. This entire site you are on now was generated using that very site generator ✨

## How's it work?

## But don't you need *X*?

## So out the window with everything?


Code Block (md2html.ts)

```typescript
import { Marked } from "./mod.ts";

const decoder = new TextDecoder("utf-8");
const filename = Deno.args[0];
const markdown = decoder.decode(await Deno.readFile(filename));
const markup = Marked.parse(markdown);
console.log(markup.content);
console.log(JSON.stringify(markup.meta));
```
