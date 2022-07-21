# Hi there 👋
This is the source code for my [personal blog]([personal blog](https://herluf-ba.github.io). It's statically generated using [Deno](https://deno.land/) and the [markdown package](https://deno.land/x/markdown@v2.0.0).
Feel free to clone and reuse everything you see here - apart from the actual posts, but idk why you would do that anyway 🤷‍♀️

```bash
# To generate site run:
deno run --allow-read --allow-write build.ts

# To convert images in docs/images to webp format run:
for file in docs/images/*; do bin/cwebp "$file" -o "${file%.*}.webp"; done
```
