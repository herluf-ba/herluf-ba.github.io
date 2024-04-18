---
title : A neat way to switch git branches
description : 'Fuzzy-find git branches using fzf.'
publishedAt: '2024-04-18T12:00:00Z'
tags: 
  - tips
  - terminal
  - git
---
When I work on repositories with many git branches I often forget the name of the branch I want to work on.
So I made a `gbs` (git-branch-search) command in my zsh config!
```bash
# Fuzzy-find git branches and checkout afterwards.
gbs() {
  # List all branches in current repository.
  git branch -a |
  # Fuzzy find them using fzf. Place the search-bar at the bottom and add a nice header.
  # Render a preview of 'git log'  for each branch with bat.
  fzf --layout reverse-list --header="Select branch" \
      --preview "echo {} | sed 's/ //g' | xargs git log | bat --color=always --theme=gruvbox-dark -p" |
  # Finally checkout to the selected branch.
  xargs git checkout
}

```
Here it is in action
```asciinema 
git-branch-search.cast
```