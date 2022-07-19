---
title : Test
summary : An article about how actually avoiding overcomplication can make for better solutions
publishedAt: '2022-07-19T12:33:56Z'
tags: 
  - rant
---
I work in web development. Recently I've found myself becoming increasingly frustrated with *overcomplication*. So many of the challenges I have to face at work stem from an increasingly complex setup that in the end comes together to produce a pretty standard website. 

![Some nice image]({{PUBLIC}}/images/test.webp)

So, half as a fun **side-project** and half out of *spite*, I'm writing a static site generator to illustrate what I consider a more pragmatic approach. This entire site you are on now was generated using that very site generator ✨

## How's it work?

```typescript
import { Marked } from "./mod.ts";

const decoder = new TextDecoder("utf-8");
const filename = Deno.args[0];
const markdown = decoder.decode(await Deno.readFile(filename));
const markup = Marked.parse(markdown);
console.log(markup.content);
console.log(JSON.stringify(markup.meta));
```

I work in web development. Recently I've found myself becoming increasingly frustrated with *overcomplication*. So many of the challenges I have to face at work stem from an [increasingly complex setup](https://www.google.dk) that in the end comes together to produce a pretty standard website. :fire: So, half as a fun side-project and half out of spite, ~~I'm writing a static site generator~~ to illustrate what I consider a more pragmatic approach. This entire site you are on now was generated using that very site generator ✨

I work in web development. Recently I've found myself becoming increasingly frustrated with *overcomplication*. So many of the challenges I have to face at work stem from an increasingly complex setup that in the end comes together to produce a pretty standard website. So, half as a fun side-project and half out of spite, I'm writing a static site generator to illustrate what I consider a more pragmatic approach. This entire site you are on now was generated using that very site generator ✨

### But don't you need *X*?
I work in web development. Recently I've found myself becoming increasingly frustrated with *overcomplication*. So many of the challenges I have to face at work stem [from]({{PUBLIC}}/writing-a-static-site-generator-should-be-that-hard.md) an increasingly complex setup that in the end comes together to produce a pretty standard website. So, half as a fun side-project and half out of spite, I'm writing a static site generator to illustrate what I consider a more pragmatic approach. This entire site you are on now was generated using that very site generator ✨

I work in web development. Recently I've found myself becoming increasingly frustrated with *overcomplication*. So many of the challenges I have to face at work stem from an increasingly complex setup that in the end comes together to produce a pretty standard website. So, half as a fun side-project and half out of spite, I'm writing a static site generator to illustrate what I consider a more pragmatic approach. This entire site you are on now was generated using that very site generator ✨

#### So out the window with everything?
I work in web development. Recently I've found myself becoming increasingly frustrated with *overcomplication*. 
> So many of the challenges I have to face at work stem from an increasingly complex setup that in the end comes together to produce a pretty standard website. 
So, half as a fun side-project and half out of spite, I'm writing a static site generator to illustrate what I consider a more pragmatic approach. This entire site you are on now was generated using that very site generator ✨

```typescript
import { Marked } from "./mod.ts";

const decoder = new TextDecoder("utf-8");
const filename = Deno.args[0];
const markdown = decoder.decode(await Deno.readFile(filename));
const markup = Marked.parse(markdown);
console.log(markup.content);
console.log(JSON.stringify(markup.meta));
```
