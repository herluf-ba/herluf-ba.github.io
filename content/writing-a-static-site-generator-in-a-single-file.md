---
title : Writing a static site generator in a single file
description : Writing a minimal static site generator using deno, typescript and markdown files
publishedAt: '2022-07-20T12:00:00Z'
tags: 
  - deno
  - webdev
  - typescript
---
Since I decided to try to do [this blog](herluf-ba.github.io), I have been looking around for a Static Site Generator (SSG) that does what I want. I looked at [Jekyll](https://jekyllrb.com/), [Hugo](https://gohugo.io/), [Gatsby](https://www.gatsbyjs.com/), [Eleventy](https://www.11ty.dev/) and a bunch more. Thruth is any one of these would meet my needs, but I still had this itch that these frameworks were overkill for my usecase, that I would be better off with something smaller. Maybe I read too much [unixsheikh](https://unixsheikh.com/articles/using-a-framework-can-make-you-stupid.html) but I decided to write my own 🤷‍♂️

## How to write a Static Site Generator
At its core a Static Site Generator *eats some content data and spits out some html file(s)*. The content data is markdown files in my case. For instance you can see the markdown for this post [right here]()



