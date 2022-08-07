---
title : Making a turn based multiplayer game in Rust - Game logic and server (part 2/3)
description : 'A tutorial series about writing turn based multiplayer games using Rust and the Bevy game engine. This part 2 of 3 where we will use the reducer pattern that was introduced in the previous post, to write a server for our game'
publishedAt: '2022-07-26T13:00:00Z'
tags: 
  - rust
  - gamedev
---

> This is part 2 of 3 in a tutorial series about making a turn-based online multiplayer game in Rust. In this series we will be building a small game called TicTacTussle. In this post we will use the reducer pattern that was introduced in the [previous post](https://herluf-ba/herluf-ba.github.io/making-a-turn-based-multiplayer-game-in-rust-01-whats-a-turn-based-game-anyway), to write a server for our game. In the [third and final post](https://herluf-ba.github.io/making-a-turn-based-multiplayer-game-in-rust-03-writing-a-client-using-bevy) we will write a client for the game using the awesome Bevy game engine.

Welcome back! 👋 In this post we will use the reducer pattern to write our game server. Let's just get started right away!

## A good starting point
To get straight into the intresting bits of the project I've prepared a template for us to use. It sits in a branch of the tic-tac-tussle respository, so it's easy to clone like this:
```bash
git clone -b template https://github.com/herluf-ba/tic-tac-tussle.git
# Or however you like to do your clonin' (you can use the zip-download, I won't judge 👀)
```
The template is a [cargo workspace](https://doc.rust-lang.org/book/ch14-03-cargo-workspaces.html) with two binaries `client` and `server` and a library they both use called `store`. All three has a `Cargo.toml` file with the necessary dependencies already added to them as well as an empty `src/[main/lib].rs`. The `client` also has some assets for us to use, once we get around to writing that in the next post.
```text
tic-tac-tussle/
├── client/
|   ├── Cargo.toml
|   ├── assets/*
|   ├── src/
|   |   ├── main.rs
├── server/
|   ├── Cargo.toml
|   ├── src/
|   |   ├── main.rs
├── store/
|   ├── Cargo.toml
|   ├── src/
|   |   ├── lib.rs
```

## What's next?
That's it for this post. In the next one, we will write a client application using the [Bevy game engine](https://bevyengine.org/) so we can finally play a round of TicTacTussle! 

You can already [read part 3 here](https://herluf-ba.github.io/making-a-turn-based-multiplayer-game-in-rust-03-writing-a-client-using-bevy) 🕺

Thank you for reading! If you see something that's wrong, I would appreciate it very much if you would [make a pull request](https://github.com/herluf-ba/herluf-ba.github.io/pulls). If you want to talk to me [I'd love to receive an email](mailto:herlufbaggesen13@gmail.com), but I'm also sporatically active on the [Bevy Discord](https://discord.gg/bevy)
