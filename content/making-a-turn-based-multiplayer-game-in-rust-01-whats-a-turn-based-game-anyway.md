---
title : Making a turn based multiplayer game in Rust - What's a turn based game anyway? (part 1/3)
description : 'A tutorial series about writing turn based multiplayer games using Rust and the Bevy game engine. This part 1/3 which goes into what charaterizes a turn based game and presents a pattern for synchronizing states between players.'
publishedAt: '2022-07-26T12:00:00Z'
tags: 
  - rust
  - gamedev
---

> This is part 1/3 in a tutorial series about making a turn-based online multiplayer game in Rust. In this series we will be building a small game called TicTacTussle. This post descripes what we are trying to achieve, and presents a way to design our code to support that. In the [second post](TODO) we will write the server and game-logic and in the [third and final post](TODO) we will write a client for the game using the awesome Bevy game engine.

Welcome! I am currently working on a casual online card game called Habitat. For this, I have had to think long and hard about how I wanted to approach networking in my game, and I think I have come up with a pretty solid solution (famous last words). So, for the good of all of us, I have decided to describe this solution in a tutorial series! 

To convince you that this pattern is actually nice to work with, we will be building a tic-tac-toe clone called TicTacTussle. In this post I will go into detail about what I mean by "turn-based" and theorize about how we can do networking when working on turn-based games. I'm assuming you are familiar with Rust, what a server and a client is and the rules for tic tac toe. If you aren't, you could just try to follow along anyway, I'm sure you would get most of it 😉

First off, we should get into what characterizes a "turn-based game".

## What games are "turn-based"?
Turn-based games are games where a group of players play the game by performing a *sequence of actions* that advance the game. Usually only a single player has the ability to perform actions at a time. We can think of a *turn* as a group of one or more actions that, once performed, hands over the privilige of performing actions from one player to another. A large group of games that fit this description are of course board games, like Monopoly, Uno or a favorite of mine [Ticket to Ride](https://www.daysofwonder.com/tickettoride/en/usa/). 

A very important trait of what we will call "turn-based" is that **the state of the game can be detemined solely from a sequence of actions**. This trait has some nice concequences that we will be exploiting once we start writing code. To get familiar with these derived consequenses, lets consider an example from one of the OG turn-based games: Chess ♟

![A position in a game of chess](../images/chess-position.webp)

Let say we wanted to save the state of the board in the picture above. Well that's fairly straight forward, we could just do something like
```rust
enum Piece {
  // White pawn, bishop, knight, rook, queen and king 
  WP, WB, WN, WR, WQ, WK,
  // Black pawn, bishop, knight, rook, queen and king 
  BP, BB, BN, BR, BQ, BK
}

struct Board(Vec<Vec<Option<Piece>>>);

let the_board_from_the_image = {
  use Piece::*;
  Board(vec![
    vec![Some(BR), None,     None,     Some(BQ), Some(BK), Some(BB), None,     Some(BR)],
    vec![Some(BP), Some(BB), Some(BP), Some(BN), None,     Some(BP), Some(BP), Some(BP)],
    vec![None,     Some(BP), None,     None,     None,     None,     None,     None   ],
    vec![None,     None,     None,     Some(BP), None,     None,     Some(WB), None   ],
    vec![None,     None,     None,     Some(WP), None,     None,     None,     None   ],
    vec![Some(WP), None,     None,     None,     None,     Some(WN), None,     None   ],
    vec![None,     Some(WP), Some(WQ), None,     Some(WP), Some(WP), Some(WP), Some(WP)],
    vec![Some(WR), None,     None,     None,     Some(WK), Some(WB), None,     Some(WR)],
  ])
};
```
How could we synchronize a game of chess between players playing online? A naive approach would be to just have a server recieve moves from each player, calculate a new Board based on that move and then send this new Board to both players. That would work, and honestly you could probably make a game with that approach as long as the size of the games state, ie. the Board struct, isn't too large.

A more efficient, and frankly straight up cooler, solution is to just have the server send the *move the player performs* rather than the state. Because *the game state can be determined from a sequence of actions*, the players themselves can determine the most recent board. This way the messages between the server and players become something like `GameEvent::MovePiece { piece: Piece::Rook, position: "a4" }` rather than `*entire board with all the pieces*`, which almost always is way smaller!

In fact, this approach of thinking about a game state as a *sequence of actions* is so useful that it was [adobted by chess players](https://en.wikipedia.org/wiki/Algebraic_notation_(chess)) to describe a game of chess around 1847(!). This was of course way before the internet, so the reduced bandwidth usage might not have been too intresting to these guys. Although one can imagine the painstaking task of drawing each board of a game of chess, if you were writing a book trying to explain your favorite openings. The image shown above is from a game between Garry Kasparov and Anatoly Karpov and that entire game can be decribed by these moves (*cheffs kiss ~ mwaaah*)
```text
1. d4 Nf6 2. c4 e6 3. Nf3 b6 4. Nc3 Bb7 5. a3 d5 6. cxd5 Nxd5 7. Qc2 Nd7 8. Nxd5
exd5 9. Bg5 f6 10. Bf4 c5 11. g3 g6 12. h4 Qe7 13. Bg2 Bg7 14. h5 f5 15. Qd2 Bf6
16. Rc1 Rc8 17. Rc3 Rc6 18. Re3 Re6 19. Rxe6 Qxe6 20. Ng5 Qe7 21. dxc5 Nxc5 22.
hxg6 d4 23. g7 Bxg7 24. Bxb7 Qxb7 25. f3 Qd5 26. Rxh7 Rxh7 27. Nxh7 Qb3 28. Bd6
Ne6 29. Ng5 Bh6 30. Bf4 Bxg5 31. Bxg5 Nxg5 32. Qxg5 Qxb2 33. Qxf5 Qc1+ 34. Kf2
Qe3+ 35. Kf1 Qc1+ 36. Kg2 Qxa3 37. Qh5+ Kd7 38. Qg4+ Kc6 39. Qxd4 b5 40. g4 b4
41. g5 1-0
```

Some other less obvious consequenses of thinking about game states as sequences of actions are:
- It's fairly straight forward to implement undo and redo functionality. Just pop or push actions onto the sequence.
- Saving and loading games can be done by simply saving and loading the sequence of actions.
- Having the actions players perform in the game, given a particular sequence of previous actions is *very useful* if we want to train a machine learning algorithm to add intresting bots to our games. 

Now that we have established "turn-based games" as games that can be thought of as a *sequence of actions*, let's start thinking about how to design our code around this.

## A pattern for online turn-based games
The overall problem we are trying to solve, is to have the server and the players agree on the state of the game. One solution to this problem is to use the incredibly useful **reducer pattern**, sometimes refered to as the "event pattern" or the ["command pattern"](https://gameprogrammingpatterns.com/command.html). At its core it's super simple: 

**A *reducer* is a function that takes a state and an event and produces a new state**

Already sounds familiar right? Events are just what we have been calling actions up until now. Events is what the players and server are going to use to communicate with each other. The "state" is, well, the state of our game! Both the server and all players will hold their own version the game state and both will use the same reducer function to update these states when they receive events. 

Using this pattern also lets us address the issue of cheating fairly easily. We will just have the server determine if the event a player is trying to add to the game state looks valid, before sending it to all players. Such a simple way to **reduce** cheating to zero in our game (pun intented times a thuosand).

So the game will progress like this:
1. Player sends event to the server
2. The server inspect the event and verifies that it is valid and allowed
3. The server updates its own state using the reducer function
4. The server send the valid event to all players
5. Each player uses the reducer function to update their states
6. Either someone has won or we go to 1. 

Here's a visual representation for those of us that, like me, learn best when there's nice colors involved:

![An illustration of how the game progresses](../images/update-state.gif)

Now lets look at how we could implement the reducer pattern in rust!

## How do we write a reducer in Rust?
If we were 

```rust
use std::collections::HashMap;

pub struct GameState {
    players: HashMap<u64, String>,
    history: Vec<GameEvent>,
}

#[derive(Clone)]
pub enum GameEvent {
    PlayerJoined { player_id: u64, name: String },
}

impl GameEvent {
    /// Determines if the event is valid on a particular gamestate
    pub fn is_valid_on(&self, game_state: &GameState) -> bool {
        use GameEvent::*;
        match self {
            PlayerJoined { player_id, name: _ } => {
                if game_state.players.contains_key(player_id) {
                    return false;
                }
            }
        }

        true
    }
}

impl GameState {
    /// Aggregates an event into the GameState. 
    /// Note that the event is assumed to be valid when reduce is called
    fn reduce(&mut self, valid_event: &GameEvent) {
        use GameEvent::*;
        match valid_event {
            PlayerJoined { player_id, name } => {
                self.players.insert(*player_id, name.to_string());
            }
        }

        self.history.push(event.clone());
    }

    /// Dispatches an event, modifying the GameState
    pub fn dispatch(&mut self, event: &GameEvent) {
        if event.is_valid_on(&self) {
            self.reduce(event);
        }
    }
}
```

## What's next?
That's it for this post. In the next one, we will setup a Rust workspace, write the server for our game and adapt our gamestate implementation into a library that the server can use. You can already [read part 2 here](TODO) 🕺

Thank you for reading! If you see something that's wrong, I would appreciate it very much if you would [make a pull request](TODO). If you want to talk to me [I'd love to receive an email](mailto:herlufbaggesen13@gmail.com), but I'm also sporatically active on the [Bevy Discord](https://discord.gg/bevy)
