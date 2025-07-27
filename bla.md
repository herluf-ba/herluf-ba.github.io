# Writing my own editor

In carpentry there's this idea that if you really want to understand your tools you should try to make them.
When you set out to make your own hammer, you get to appreciate its qualities in a completely different way.
You notice the carefully formed shape and length of the handle,
that gives the right grip and let's you swing to strike with the right amount of force.
The next time you pick up another hammer, you notice that the head is slightly wider and heavier,
and you wonder what application might suit this type of hammer.

I'm no carpenter, although I dabble.
I _am_ a software engineer though, and I think this idea applies in my line of work too.
The tools I use are all software. `git`, `rustc`, `tsc`, `node`, `npm`, `rg`, `lf`, `hx`, `tmux`, `ssh`, `curl`, `nvim` and many more.  
Like a carpenter I work with tools, made in the medium that I do my work in.
And frankly, I can't think of anything cooler than writing code in _an editor I wrote myself_.

## False starts
Since "writing my own editor" is such a cool idea, naturally I have started doing so a couple of times already.
The first time around I started in Rust. I made it to the point where you could use the editor to read code, but there was no editing.
Which was a shame, because I was going for an _editor_ not a _reader_.
The second go I had at this was half a year ago and this time I had just picked up Zig.
I wanted a challenge, so I thought that I'd try this editor thing again.
This time I didn't even make it to the reading part.

I think it's common to have false starts on difficult projects like these. It is for me at least.
With no prior experience in writing editors, it would be kind of amazing if I didn't make mistakes and had to backtrack a whole lot.
And I try to think of starting over as just "backtracking all the way to the origin".
Like stashing you branch and branching a new one out from `main`.
We all do that sometimes, if our first or second idea turns out not to be useful.

Because I did try my hand at editor-writing already, I now have a hunch on what might be a good way to start this time around.
Something I did wrong for instance, was to not establish a good UI rendering base before moving straight to reading and displaying files.
Those false starts inform my current attempt, which may end up in the same spot as it's predececors.
That's okay, because I learn something new with every attempt, and ultimately I am just doing this for street-cred. 

## You keep saying "editor", what does that mean?
A "code editor" can mean so many different things.
I am going to try to make a _terminal editor_ like vim, emacs, or my current daily driver helix.
That means a program you run from the command line, and primarily interact with via the keyboard.
It brings me joy to program in these kinds of editors so of course, if I'm making my own, that's the kind I should go for.
The features I rely on are:
- Modal editing. Where there's one mode for "reading and navigating in code" and another for "editing code".
  In vim-likes the first one called _normal mode_ and the second _insert mode_.
- "Select-then-act". This is pattern from helix. Essentially everytime you want to do something you first select the part you want to act on and then you do the action.
 So you do `wd` to "select a word and delete it" as opposed to vim-style `dw` to "delete a word". The benefit with select-then-act is that the editor can give visual feedback before the action happens.  
- Search-based navigation. When I need to open a file in my project, I open a searchbar and fuzzy-search my way to the file I am looking for.
  When I need to find a certain function, I do the same: fuzzy search for the function in a list of project symbols.
  To me, this is just way faster and more convenient, so it's a must for me now.

All of the features above are in helix. It really is my personal ideal of an editor and I enjoy using it.
So why make my own, why not just use helix and call it a day?
Well, the value in making your own tools is not innovation.
The value in recreating is understanding and appreciating.
Carpenters usually don't set out to make a completely new and unique hammer.
They make a hammer that's like the one they already have.


