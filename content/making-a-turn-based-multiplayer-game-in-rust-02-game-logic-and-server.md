---
title : Making a turn-based multiplayer game in Rust - Game logic and server (part 2/3)
description : 'A tutorial series about writing turn-based multiplayer games using Rust and the Bevy game engine. This part 2 of 3 where we will use the reducer pattern that was introduced in the previous post, to write a server for our game'
publishedAt: '2022-07-26T13:00:00Z'
tags: 
  - rust
  - gamedev
  - tutorial
---

> This is part 2 of 3 in a tutorial series about making a turn-based online multiplayer game in Rust. In this series we will be building a small game called TicTacTussle. In this post we will use the reducer pattern that was introduced in the [previous post](https://herluf-ba/herluf-ba.github.io/making-a-turn-based-multiplayer-game-in-rust-01-whats-a-turn-based-game-anyway), to write a server for our game. In the [third and final post](https://herluf-ba.github.io/making-a-turn-based-multiplayer-game-in-rust-03-writing-a-client-using-bevy) we will write a client for the game using the awesome Bevy game engine.

Welcome back! 👋 In this post we will use the reducer pattern to write our game server. Let's just get started right away!

## A good starting point
To get straight into the interesting bits of the project I've prepared a template for us to use. It sits in a branch of the tic-tac-tussle repository, so it's easy to clone like this:
```bash
git clone -b template https://github.com/herluf-ba/tic-tac-tussle.git
# Or however you like to do your clonin' (you can use the zip-download, I won't judge 👀)
```
The template is a [cargo workspace](https://doc.rust-lang.org/book/ch14-03-cargo-workspaces.html) with two binaries `client` and `server` and a library they both use called `store`. All three have a `Cargo.toml` file with the necessary dependencies already added to them as well as an empty `src/[main/lib].rs`. The `client` also has some assets for us to use, once we get around to writing that in the next post.
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

## Using renet to write a game server
Writing a game server can be a daunting task. There are lots of rabbit holes to get sucked into! What networking protocol is best suited for our game? How do we keep track of players connecting and disconnecting? How do we broadcast messages to players? How do we establish secure connections to players? How do we protect our servers from malicious stuff like DDoS or replay attacks?

All these questions present interesting, albeit time-devouring, challenges for any programmer, and it's easy to spend weeks mucking around with reliable UDP channels and the like. So instead of writing the whole thing from scratch, we can save an ocean of time by using one of the [many networking crates](https://arewegameyet.rs/ecosystem/networking/) written by the generous rust community.

For this project, we will be using [renet](https://crates.io/crates/renet). It's an awesome crate with a bunch of features. Some of the crucial ones for us are that it: 
- handles sending packages over UDP
- handles player connects and disconnects
- prevents players from various malicious behaviors
- has a bevy client library (which we will use in the next post!)

Renet has nice examples to get us started. Let's write a minimal server in `server/src/main.rs`, which is just a slightly altered version of the ["echo" example](https://github.com/lucaspoffo/renet/blob/master/renet/examples/echo.rs)

```rust
// server/src/main.rs

use log::{info, trace};
use renet::{RenetConnectionConfig, RenetServer, ServerAuthentication, ServerConfig, ServerEvent};
use std::net::{SocketAddr, UdpSocket};
use std::time::{Duration, Instant, SystemTime};

// Only clients that can provide the same PROTOCOL_ID that the server is using will be able to connect.
// This can be used to make sure players use the most recent version of the client for instance.
pub const PROTOCOL_ID: u64 = 1208;
// TicTacTussle converted to utf-8 codes is 84 105 99 84 97 99 84 117 115 115 108 101
// If you add those up you get 1208.
// It is not necessary to do the PROTOCOL_ID like this but it is fun 🤷‍♂️

fn main() {
    env_logger::init();

    let server_addr: SocketAddr = "127.0.0.1:5000".parse().unwrap();
    let mut server: RenetServer = RenetServer::new(
        // Pass the current time to renet, so it can use it to order messages
        SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap(),
        // Pass a server configuration specifying that we want to allow only 2 clients to connect
        // and that we don't want to authenticate them. Everybody is welcome!
        ServerConfig::new(2, PROTOCOL_ID, server_addr, ServerAuthentication::Unsecure),
        // Pass the default connection configuration. 
        // This will create a reliable, unreliable and blocking channel.
        // We only actually need the reliable one, but we can just not use the other two.
        RenetConnectionConfig::default(),
        UdpSocket::bind(server_addr).unwrap(),
    )
    .unwrap();

    trace!("🕹  TicTacTussle server listening on {}", server_addr);

    let mut last_updated = Instant::now();
    loop {
        // Update server time
        let now = Instant::now();
        server.update(now - last_updated).unwrap();
        last_updated = now;

        // Receive connection events from clients
        while let Some(event) = server.get_event() {
            match event {
                ServerEvent::ClientConnected(id, _user_data) => {
                    info!("🎉 Client {} connected.", id);
                }
                ServerEvent::ClientDisconnected(id) => {
                    info!("👋 Client {} disconnected", id);
                }
            }
        }
        std::thread::sleep(Duration::from_millis(50));
    }
}
```
So far, not too bad 👍 Hopefully it comes across just how much renet is bringing to the project! Now, a server that logs connects and disconnects is like a "hello world" version of a game server. Or is that an echo server? Anyway, to play TicTacTussle we need some game logic! This is where our reducer pattern from the previous post resurges. Let's work on the `store` library next!

## Writing game logic using the reducer pattern
Considering that we are already experts on the reducer pattern and know why it's cool, why don't we just start working on `store/src/lib.rs` by adding a `GameState` struct:

```rust
// store/src/lib.rs
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// This just makes it easier to dissern between a player id and any ol' u64
type PlayerId = u64;

/// Possible states that a position in the board can be in
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum Tile {
    Empty,
    Tic,
    Tac,
}

/// Struct for storing player related data.
/// In tic-tac-toe the only thing we need is the name and the piece the player will be placing
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Player {
    pub name: String,
    pub piece: Tile,
}

/// The different states a game can be in. (not to be confused with the entire "GameState")
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Stage {
    PreGame,
    InGame,
    Ended,
}

/// A GameState object that is able to keep track of a game of TicTacTussle
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct GameState {
    pub stage: Stage,
    pub board: [Tile; 9],
    pub active_player_id: PlayerId,
    pub players: HashMap<PlayerId, Player>,
    pub history: Vec<GameEvent>,
}


impl Default for GameState {
    fn default() -> Self {
        Self {
            stage: Stage::PreGame,
            board: [
                Tile::Empty,
                Tile::Empty,
                Tile::Empty,
                Tile::Empty,
                Tile::Empty,
                Tile::Empty,
                Tile::Empty,
                Tile::Empty,
                Tile::Empty,
            ],
            active_player_id: 0,
            players: HashMap::new(),
            history: Vec::new(),
        }
    }
}
```
That's already a lot more complicated than the `GameState` from the last post - Cool! Now let's think about what `GameEvent`s we need:
```rust
/// The reasons why a game could end
#[derive(Debug, Clone, Copy, Serialize, PartialEq, Deserialize)]
pub enum EndGameReason {
    // In tic tac toe it doesn't make sense to keep playing when one of the players disconnect.
    // Note that it might make sense to keep playing in some other game (like Team Fight Tactics for instance).
    PlayerLeft { player_id: PlayerId },
    PlayerWon { winner: PlayerId },
}

/// An event that progresses the GameState forward
#[derive(Debug, Clone, Serialize, PartialEq, Deserialize)]
pub enum GameEvent {
    BeginGame { goes_first: PlayerId },
    EndGame { reason: EndGameReason },
    PlayerJoined { player_id: PlayerId, name: String },
    PlayerDisconnected { player_id: PlayerId },
    PlaceTile { player_id: PlayerId, at: usize },
}
```
Tic tac toe is simple enough that only 5 event types is enough! Now, just like last time, we need to implement `validate` and `consume` on `GameState` to have our state interacting with events. Let's start with `validate`:
```rust
impl GameState {
    /// Determines whether an event is valid considering the current GameState
    pub fn validate(&self, event: &GameEvent) -> bool {
        use GameEvent::*;
        match event {
            BeginGame { goes_first } => {
                // Check that the player supposed to go first exists
                if !self.players.contains_key(goes_first) {
                  return false;
                }

                // Check that the game hasn't started yet. (we don't want to double start a game)
                if self.stage != Stage::PreGame {
                    return false;
                }
            }
            EndGame { reason } => match reason {
                EndGameReason::PlayerWon { winner: _ } => {
                    // Check that the game has started before someone wins it
                    if self.stage != Stage::InGame {
                        return false;
                    }
                }
                _ => {}
            },
            PlayerJoined { player_id, name: _ } => {
                // Check that there isn't another player with the same id
                if self.players.contains_key(player_id) {
                    return false;
                }
            }
            PlayerDisconnected { player_id } => {
                // Check player exists
                if !self.players.contains_key(player_id) {
                    return false;
                }
            }
            PlaceTile { player_id, at } => {
                // Check player exists
                if !self.players.contains_key(player_id) {
                    return false;
                }
                // Check player is currently the one making their move
                if self.active_player_id != *player_id {
                    return false;
                }

                // Check that the tile index is inside the board
                if *at > 8 {
                    return false;
                }

                // Check that the player is not trying to place piece on top of another 
                // (which is considered a cheeky move in tic tac toe)
                if self.board[*at] != Tile::Empty {
                    return false;
                }
            }
        }

        // We couldn't find anything wrong with the event so it must be good 
        true
    }
}
``` 
And we can make `consume` like this:
```rust
impl GameState {
    // validate ...

    /// Consumes an event, modifying the GameState and adding the event to its history
    /// NOTE: consume assumes the event to have already been validated and will accept *any* event passed to it
    pub fn consume(&mut self, valid_event: &GameEvent) {
        use GameEvent::*;
        match valid_event {
            BeginGame { goes_first } => {
                self.active_player_id = *goes_first;
                self.stage = Stage::InGame;
            }
            EndGame { reason: _ } => self.stage = Stage::Ended,
            PlayerJoined { player_id, name } => {
                self.players.insert(
                    *player_id,
                    Player {
                        name: name.to_string(),
                        // First player to join gets tac, second gets tic
                        piece: if self.players.len() > 0 {
                            Tile::Tac
                        } else {
                            Tile::Tic
                        },
                    },
                );
            }
            PlayerDisconnected { player_id } => {
                self.players.remove(player_id);
            }
            PlaceTile { player_id, at } => {
                let piece = self.players.get(player_id).unwrap().piece;
                self.board[*at] = piece;
                self.active_player_id = self
                    .players
                    .keys()
                    .find(|id| *id != player_id)
                    .unwrap()
                    .clone();
            }
        }

        self.history.push(valid_event.clone());
    }
}
```
Looking at `consume` it's clear that tic tac toe is a pretty simple game 😅 Finally, since we know that we will need it later, we should add a way to determine if a player has won the game:
```rust
impl GameState {
    // validate...
    // consume...

    /// Determines if someone has won the game
    pub fn determine_winner(&self) -> Option<PlayerId> {
        // All the combinations of 3 tiles that wins the game
        let row1: [usize; 3] = [0, 1, 2];
        let row2: [usize; 3] = [3, 4, 5];
        let row3: [usize; 3] = [6, 7, 8];
        let col1: [usize; 3] = [0, 3, 6];
        let col2: [usize; 3] = [1, 4, 7];
        let col3: [usize; 3] = [2, 5, 8];
        let diag1: [usize; 3] = [0, 4, 8];
        let diag2: [usize; 3] = [2, 4, 6];

        for arr in [row1, row2, row3, col1, col2, col3, diag1, diag2] {
            // Read tiles from board
            let tiles: [Tile; 3] = [self.board[arr[0]], self.board[arr[1]], self.board[arr[2]]];
            // Determine if tiles are all equal
            let all_are_the_same = tiles
                .get(0)
                .map(|first| tiles.iter().all(|x| x == first))
                .unwrap_or(true);

            if all_are_the_same {
                // Determine which of the players won
                if let Some((winner, _)) = self
                    .players
                    .iter()
                    .find(|(_, player)| player.piece == self.board[arr[0]])
                {
                    return Some(*winner);
                }
            }
        }

        None
    }
}
```
That's all the game logic we need. Next, we should head back to `server/src/main.rs` and make sure it uses our newly implemented `GameState`.

## Making our server stateful
Back in `server/src/main.rs` we are now ready to finish our game server! There are a couple of things we are now able to do: 
- We need to tell players that connect to the server about the other players that are already connected. Likewise, already connected players need to get notified about new players connecting.
- When two players have connected we can start the game, since tic tac toe only required two players.
- When a player disconnects, we need to end the game. Playing alone is kinda boring.
- When a player submits a `GameEvent` we need to validate it. If it's good we need to broadcast it to all players so they can advance their `GameState`s.

Let's start from the top by handling player connects!
```rust
// server/src/main.rs
fn main() {
    // ...
    loop {
        // ...

        while let Some(event) = server.get_event() {
            match event {
                ServerEvent::ClientConnected(id, user_data) => {
                    // Tell the recently joined player about the other player
                    for (player_id, player) in game_state.players.iter() {
                        let event = store::GameEvent::PlayerJoined {
                            player_id: *player_id,
                            name: player.name.clone(),
                        };
                        server.send_message(id, 0, bincode::serialize(&event).unwrap());
                    }

                    // Add the new player to the game
                    let event = store::GameEvent::PlayerJoined {
                        player_id: id,
                        name: name_from_user_data(&user_data),
                    };
                    game_state.consume(&event);

                    // Tell all players that a new player has joined
                    server.broadcast_message(0, bincode::serialize(&event).unwrap());

                    info!("Client {} connected.", id);
                    // In TicTacTussle the game can begin once two players has joined
                    if game_state.players.len() == 2 {
                        let event = store::GameEvent::BeginGame { goes_first: id };
                        game_state.consume(&event);
                        server.broadcast_message(0, bincode::serialize(&event).unwrap());
                        trace!("The game gas begun");
                    }
                }
                ServerEvent::ClientDisconnected(id) => {
                  // ...
                }
            }
        }
    }
}
```
At first, it can be a little tricky to get the connection logic working, since both the player connecting needs to know about the other players, and they also need to know about the player connecting. It can be even more complicated if the game you are making allows players to connect to ongoing games, since then you'll need a more elaborate synchronizing step. Luckily that's not the case for us. Moving on to disconnects!
```rust
fn main() {
    // ...
    loop {
        // ...

        while let Some(event) = server.get_event() {
            match event {
                ServerEvent::ClientConnected(id, user_data) => {
                  // ...
                }
                ServerEvent::ClientDisconnected(id) => {
                    // First consume a disconnect event
                    let event = store::GameEvent::PlayerDisconnected { player_id: id };
                    game_state.consume(&event);
                    server.broadcast_message(0, bincode::serialize(&event).unwrap());
                    info!("Client {} disconnected", id);

                    // Then end the game, since tic tac toe can't go on with a single player
                    let event = store::GameEvent::EndGame {
                        reason: EndGameReason::PlayerLeft { player_id: id },
                    };
                    game_state.consume(&event);
                    server.broadcast_message(0, bincode::serialize(&event).unwrap());

                    // NOTE: Since we don't authenticate users we can't do any reconnection attempts.
                    // We simply have no way to know if the next user is the same as the one that disconnected.
                }
            }
        }
    }
}
```
It might not seem like it, but our server is almost done! We just need to broadcast valid `GameEvents` to all players when we receive them. We can do that like this:
```rust
fn main() {
    // ...
    loop {
        // ...
        while let Some(event) = server.get_event() {
            match event {
                ServerEvent::ClientConnected(id, user_data) => {
                    // ...
                }
                ServerEvent::ClientDisconnected(id) => {
                    // ...
                }
            }
        }

        // Receive GameEvents from clients. Broadcast valid events.
        for client_id in server.clients_id().into_iter() {
            while let Some(message) = server.receive_message(client_id, 0) {
                if let Ok(event) = bincode::deserialize::<store::GameEvent>(&message) {
                    if game_state.validate(&event) {
                        game_state.consume(&event);
                        trace!("Player {} sent:\n\t{:#?}", client_id, event);
                        server.broadcast_message(0, bincode::serialize(&event).unwrap());

                        // Determine if a player has won the game
                        if let Some(winner) = game_state.determine_winner() {
                            let event = store::GameEvent::EndGame {
                                reason: store::EndGameReason::PlayerWon { winner },
                            };
                            server.broadcast_message(0, bincode::serialize(&event).unwrap());
                        }
                    } else {
                        warn!("Player {} sent invalid event:\n\t{:#?}", client_id, event);
                    }
                }
            }
        }

        server.send_packets().unwrap();
        thread::sleep(Duration::from_millis(50));
    }
}
```
And our server is now finished! 🎉 The actual server code is fairly short, but that's because we separated the game logic out into its own library.

## What's next?
That's it for this post. In the next one, we will write a client application using the [Bevy game engine](https://bevyengine.org/) so we can finally play a round of TicTacTussle! 

You can already [read part 3 here](https://herluf-ba.github.io/making-a-turn-based-multiplayer-game-in-rust-03-writing-a-client-using-bevy) 🕺

Thank you for reading! If you see something that's wrong, I would appreciate it very much if you would [make a pull request](https://github.com/herluf-ba/herluf-ba.github.io/pulls). If you want to talk to me [I'd love to receive an email](mailto:herlufbaggesen13@gmail.com), but I'm also sporadically active on the [Bevy Discord](https://discord.gg/bevy)
