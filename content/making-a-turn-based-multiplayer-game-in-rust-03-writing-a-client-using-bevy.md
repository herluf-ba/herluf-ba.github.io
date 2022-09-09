---
title : Making a turn based multiplayer game in Rust - Writing a client using Bevy (part 3/3)
description : 'A tutorial series about writing turn based multiplayer games using Rust and the Bevy game engine. This part 3/3 which goes into the details of how to integrate a bevy client with our game server'
publishedAt: '2022-09-03T14:00:00Z'
tags: 
  - rust
  - gamedev
  - tutorial
  - bevy
---

> This is part 3/3 in a tutorial series about making a turn-based online multiplayer game in Rust. In this series we will be building a small game called TicTacTussle. In the [first post](https://herluf-ba.github.io/making-a-turn-based-multiplayer-game-in-rust-01-whats-a-turn-based-game-anyway) we established what a turn based game is and introduced the reducer pattern. In the [second post](https://herluf-ba.github.io/making-a-turn-based-multiplayer-game-in-rust-02-game-logic-and-server.html) we broke ground on TicTacTussle by writing a game server using the [renet](https://crates.io/crates/renet) crate. 

Welcome back! 👋 In this post we will write a client application for TicTacTussle using [bevy](https://bevyengine.org/). I'll be focusing on how to marry bevy with our networking strategy, so I won't be going into detail about how bevy works. Check out [the getting started guide](https://bevyengine.org/learn/book/introduction) and also [the bevy cheatbook](https://bevy-cheatbook.github.io/) for that 👍 As with last time, let's just get started right away!

## Connecting our bevy app to our game server 
First and foremost we should establish a connection between a "hello world" bevy app and our game server. Luckily we aren't starting from scratch here, as renet has a bevy client plugin called `bevy_renet` that we can use. A barebones bevy app that connects on startup looks something like this:
```rust
// client/src/main.rs
use bevy::prelude::*;
use bevy_renet::RenetClientPlugin;
use renet::{
    ClientAuthentication, RenetClient, RenetConnectionConfig, RenetError, NETCODE_USER_DATA_BYTES,
};
use std::{net::UdpSocket, time::SystemTime};

// This id needs to be the same as the server is using
const PROTOCOL_ID: u64 = 1208;

fn main() {
    // Get username from stdin args
    let args = std::env::args().collect::<Vec<String>>();
    let username = &args[1];

    App::new()
        .insert_resource(WindowDescriptor {
            // Adding the username to the window title makes debugging a whole lot easier.
            title: format!("TicTacTussle <{}>", username),
            width: 480.0,
            height: 540.0,
            ..default()
        })
        // Lets add a nice dark grey background color
        .insert_resource(ClearColor(Color::hex("282828").unwrap()))
        .add_plugins(DefaultPlugins)
        // Renet setup
        .add_plugin(RenetClientPlugin)
        .insert_resource(new_renet_client(&username).unwrap())
        .add_system(handle_renet_error)
        .run();
}

////////// RENET NETWORKING //////////
// Creates a RenetClient thats already connected to a server.
// Returns an Err if connection fails
fn new_renet_client(username: &String) -> anyhow::Result<RenetClient> {
    let server_addr = "127.0.0.1:5000".parse()?;
    let socket = UdpSocket::bind("127.0.0.1:0")?;
    let current_time = SystemTime::now().duration_since(SystemTime::UNIX_EPOCH)?;
    let client_id = current_time.as_millis() as u64;

    // Place username in user data
    let mut user_data = [0u8; NETCODE_USER_DATA_BYTES];
    if username.len() > NETCODE_USER_DATA_BYTES - 8 {
        panic!("Username is too big");
    }
    user_data[0..8].copy_from_slice(&(username.len() as u64).to_le_bytes());
    user_data[8..username.len() + 8].copy_from_slice(username.as_bytes());

    let client = RenetClient::new(
        current_time,
        socket,
        client_id,
        RenetConnectionConfig::default(),
        ClientAuthentication::Unsecure {
            client_id,
            protocol_id: PROTOCOL_ID,
            server_addr,
            user_data: Some(user_data),
        },
    )?;

    Ok(client)
}

// If there's any network error we just panic 🤷‍♂️
// Ie. Client has lost connection to server, if internet is gone or server shut down etc.
fn handle_renet_error(mut renet_error: EventReader<RenetError>) {
    for err in renet_error.iter() {
        panic!("{}", err);
    }
}
```
Now for something we have been putting off for a very long time: Running some code! Let's start our server and connect two clients 🎉
```bash
# First we start the server, as the clients assume it's available when they start
cargo run --bin server
# In another terminal:
cargo run --bin client Garry
# In a third terminal:
cargo run --bin client Anatoly

# Or you could be run-and-gun and go:
cargo run --bin server & cargo run --bin client Garry & cargo run --bin client Anatoly
# It's a fun way to make the log unreadable!
```

You should see two empty windows popping up! Our game server should be logging out: 
```bash
cargo run --bin server
  Finished dev [unoptimized + debuginfo] target(s) in 0.13s
  Running `target/debug/server`
[2022-08-25T07:41:47Z TRACE server] 🕹  TicTacTussle server listening on 127.0.0.1:5000
[2022-08-25T07:41:50Z INFO  server] Client 1661413309885 connected.
[2022-08-25T07:42:12Z INFO  server] Client 1661413332382 connected.
[2022-08-25T07:42:12Z TRACE server] The game gas begun
```

Fantastic! ✨ Somehow, even though I have been connecting stuff on the internet for years now, I still get excited about that initial connect. There's just something about it!

> There's a gotcha here! To have enable logging we need to specify the 'log level' of each of our projects so `env-logger` will actually log out stuff to the terminal. This is done via environment variables, so we could just go `RUST_LOG=server cargo run --bin server`. Once you get tired of having to remember that everytime you're confused about missing logs, you can specify the environment using `cargo` 👍 This is done by creating a file at `.cargo/config.toml` and adding `[env] RUST_LOG="server,client"` to it.

## Spawning a game board
Okay, landing our feet on the ground after the excitement of connecting clients to a server, we start looking at the next challenge to tackle. I reckon the game would be more fun for players if they weren't staring at a blank window 🤔 We should start adding some of the assets I've prepared for us in `client/assets`. This is usually done in a `setup` function:
```rust
fn main() {
    // ...
    App::new()
        // ... 
        // Add setup function to spawn UI and board graphics
        .add_startup_system(setup)
        .run();
}

////////// COMPONENTS //////////
#[derive(Component)]
struct UIRoot;

#[derive(Component)]
struct WaitingText;

////////// SETUP //////////
fn setup(mut commands: Commands, asset_server: Res<AssetServer>) {
    // TicTacTussle is a 2D game
    // To show 2D sprites we need a 2D camera 
    commands.spawn_bundle(Camera2dBundle::default());

    // Spawn board background
    commands.spawn_bundle(SpriteBundle {
        transform: Transform::from_xyz(0.0, -30.0, 0.0),
        sprite: Sprite {
            custom_size: Some(Vec2::new(480.0, 480.0)),
            ..default()
        },
        texture: asset_server.load("background.png").into(),
        ..default()
    });

    // Spawn pregame ui
    commands
        // A container that centers its children on the screen
        .spawn_bundle(NodeBundle {
            style: Style {
                position_type: PositionType::Absolute,
                position: UiRect {
                    left: Val::Px(0.0),
                    top: Val::Px(0.0),
                    ..default()
                },
                size: Size::new(Val::Percent(100.0), Val::Px(60.0)),
                align_items: AlignItems::Center,
                justify_content: JustifyContent::Center,
                ..default()
            },
            color: Color::NONE.into(),
            ..default()
        })
        .insert(UIRoot)
        .with_children(|parent| {
            parent
                .spawn_bundle(TextBundle::from_section(
                    "Waiting for an opponent...",
                    TextStyle {
                        font: asset_server.load("Inconsolata.ttf"),
                        font_size: 24.0,
                        color: Color::hex("ebdbb2").unwrap(),
                    },
                ))
                .insert(WaitingText);
        });
}
```
You should end up with something like this:

![Pregame UI for tic tac tussle](../images/turn-based/client-pregame-ui.webp)

Whenever the player has to wait for something I think it's important to add some indication that the game isn't just frozen 🥶 We can do that pretty easily by animating the three periods at the end of the text. 
```rust
fn main() {
    // ...
    App::new()
        // ... 
        .add_system(update_waiting_text)
        .run();
}

////////// UPDATE SYSTEMS //////////
fn update_waiting_text(mut text_query: Query<&mut Text, With<WaitingText>>, time: Res<Time>) {
    if let Ok(mut text) = text_query.get_single_mut() {
        let num_dots = (time.time_since_startup().as_secs() % 3) + 1;
        text.sections[0].value = format!(
            "Waiting for an opponent{}{}",
            ".".repeat(num_dots as usize),
            // Pad with spaces to avoid text changing width and dancing all around the screen 🕺
            " ".repeat(3 - num_dots as usize)
        );
    }
}
```

## Adding input! 🕹
Pretty much any game I have ever played has had some form of player input so let's add that now! In tic tac toe inputs are manageable, there's literally only a single form of input we need to handle: Clicking on a tile to place a piece. 
```rust
fn main() {
    // ...
    App::new()
        // ... 
        .add_system(input)
        .run();
}

////////// UPDATE SYSTEMS //////////
// ...
fn input(
    windows: Res<Windows>,
    input: Res<Input<MouseButton>>,
    game_state: Res<GameState>,
) {
    let window = windows.get_primary().unwrap();
    if let Some(mouse_position) = window.cursor_position() {
        // Determine the index of the tile that the mouse is currently over
        // NOTE: This calculation assumes a fixed window size. 
        // That's fine for now, but consider using the windows size instead.
        let x_tile: usize = (mouse_position.x / 160.0).floor() as usize;
        let y_tile: usize = (mouse_position.y / 160.0).floor() as usize;
        let tile = x_tile + y_tile * 3;

        // If mouse is outside of board we do nothing
        if 8 < tile {
            return;
        }

        // If left mouse button is pressed, send a place tile event to the server
        if input.just_pressed(MouseButton::Left) {
            info!("place piece at tile {:?}", tile);
        }
    }
}
```

Nice! We are making progress with the client! There's one more addition I'd like to make before we dive into the networking details and that's some hover effect when players hover a specific tile. It's just a small touch that makes the game feel a lot more polished in my opinion. I guess technically it's not necessary though, so feel free to skip to the next section if you are a busy fellow 🏃‍♀️

The effect is very simple: In `setup` we spawn a dot in the center of each tile but set its opacity to 0 so it's completely see-through. Then, if we know the cursor is placed on top of a tile, we show the dot in that tile by setting the opacity to 1 ✨
```rust
fn main() {
    // ...
    App::new()
        // ... 
        .add_system(input)
        .run();
}
////////// COMPONENTS //////////
// ...

type TileIndex = usize;
#[derive(Component)]
struct HoverDot(pub TileIndex);

////////// SETUP //////////
fn setup(mut commands: Commands, asset_server: Res<AssetServer>) {
    // ...
    
    // Spawn a dot in each tile for hover effect
    for x in 0..3 {
        for y in 0..3 {
            commands
                .spawn_bundle(SpriteBundle {
                    transform: Transform::from_xyz(
                        160.0 * (x as f32 - 1.0),
                        -30.0 + 160.0 * (y as f32 - 1.0),
                        0.0,
                    ),
                    sprite: Sprite {
                        color: Color::rgba(1.0, 1.0, 1.0, 0.0),
                        custom_size: Some(Vec2::new(160.0, 160.0)),
                        ..default()
                    },
                    texture: asset_server.load("dot.png").into(),
                    ..default()
                })
                .insert(HoverDot(x + y * 3));
        }
    }
}

////////// UPDATE SYSTEMS //////////
// ...
fn input(
    windows: Res<Windows>,
    input: Res<Input<MouseButton>>,
    game_state: Res<GameState>,
    mut hover_dots: Query<(&HoverDot, &mut Sprite)>,
) {
    let window = windows.get_primary().unwrap();
    if let Some(mouse_position) = window.cursor_position() {
        // Determine the index of the tile that the mouse is currently over
        // NOTE: This calculation assumes a fixed window size. 
        // That's fine for now, but consider using the windows size instead.
        let x_tile: usize = (mouse_position.x / 160.0).floor() as usize;
        let y_tile: usize = (mouse_position.y / 160.0).floor() as usize;
        let tile = x_tile + y_tile * 3;

        // If mouse is outside of board we do nothing
        if 8 < tile {
            return;
        }

        // Toggle hover dots on and off
        for (dot, mut dot_sprite) in hover_dots.iter_mut() {
            if dot.0 == tile {
                dot_sprite.color.set_a(1.0);
            } else {
                dot_sprite.color.set_a(0.0);
            }
        }

        // If left mouse button is pressed, send a place tile event to the server
        if input.just_pressed(MouseButton::Left) {
            info!("place piece at tile {:?}", tile);
        }
    }
}
```
Now I think we can all agree that that's much nicer!

![Hover effect that shows a dot when the cursor is over a tile](../images/turn-based/hover-effect.gif)

## Sending `GameEvents`
Now that we have all the scaffolding in place, it's time to send some `GameEvent`s 🚀!
```rust
fn input(
    windows: Res<Windows>,
    input: Res<Input<MouseButton>>,
    game_state: Res<GameState>,
    mut hover_dots: Query<(&HoverDot, &mut Sprite)>,
    mut client: ResMut<RenetClient>,
) {
    // 👇 NOTE THIS TOO
    // We only want to handle inputs once we are ingame
    if game_state.stage != store::Stage::InGame {
        return;
    }

    let window = windows.get_primary().unwrap();
    if let Some(mouse_position) = window.cursor_position() {
        // ...

        // If left mouse button is pressed, send a place tile event to the server
        if input.just_pressed(MouseButton::Left) {
           let event = GameEvent::PlaceTile {
                player_id: client.client_id(),
                at: tile,
            };
            client.send_message(0, bincode::serialize(&event).unwrap());
        }
    }
}
```
Well, that was easy! The `bevy-renet` plugin contains a system that will send off messages as part of the update loop, so there's nothing more for us to do sending-wise. However, you might recall that just sending the event to the server does nothing on the client-side. Stuff only happens once the server echoes back valid events to all clients! Let's have the client receive and consume `GameEvents`!
```rust
fn main() {
    // ...
    App::new()
        // ... 
        .add_system_to_stage(
            CoreStage::PostUpdate,
            // Renet exposes a nice run criteria 
            // that can be used to make sure that this system only runs when the client is connected
            receive_events_from_server.with_run_criteria(run_if_client_connected),
        )
        .run();
}

////////// RENET NETWORKING //////////
// ...
fn receive_events_from_server(
    mut client: ResMut<RenetClient>,
    mut game_state: ResMut<GameState>,
    mut game_events: EventWriter<GameEvent>,
) {
    while let Some(message) = client.receive_message(0) {
        // Whenever the server sends a message we know that it must be a game event
        let event: GameEvent = bincode::deserialize(&message).unwrap();
        trace!("{:#?}", event);

        // We trust the server - It's always been good to us!
        // No need to validate the events it is sending us
        game_state.consume(&event);

        // Send the event into the bevy event system so systems can react to it
        game_events.send(event);
    }
}
```
The game is now playable! If you start a server and connect two clients, you should start seeing event logs happening in the terminal. You can play all the way until a player emerges victorious! We have finally implemented the update loop that was introduced way back in the first post - Phew, well done! 🥇 

There's just a itty-bitty problem: The client doesn't visually update the board, so it's really hard for our less tech-savvy players to follow along. Let's rectify that with another update system:
```rust
fn main() {
    // ...
    App::new()
        // ... 
        .add_system(update_board)
        .run();
}

////////// UPDATE SYSTEMS //////////
// ...
fn update_board(
    mut commands: Commands,
    game_state: Res<GameState>,
    mut game_events: EventReader<GameEvent>,
    asset_server: Res<AssetServer>,
) {
    for event in game_events.iter() {
        match event {
            GameEvent::PlaceTile { player_id, at } => {
                let x = at % 3;
                let y = at / 3;
                let texture =
                    asset_server.load(match game_state.get_player_tile(player_id).unwrap() {
                        store::Tile::Tac => "tac.png",
                        store::Tile::Tic => "tic.png",
                        store::Tile::Empty => "dot.png", // This should never happen
                    });

                commands.spawn_bundle(SpriteBundle {
                    transform: Transform::from_xyz(
                        160.0 * (x as f32 - 1.0),
                        -30.0 + 160.0 * (y as f32 - 1.0),
                        0.0,
                    ),
                    sprite: Sprite {
                        custom_size: Some(Vec2::new(160.0, 160.0)),
                        ..default()
                    },
                    texture: texture.into(),
                    ..default()
                });
            }
            _ => {}
        }
    }
}
```
And would you look at that; we got ourselves a working client application!

![Two players placing tiles on a game board with network synchronization](../images/turn-based/placing-tiles.gif)

## Adding UI 📊
The final piece to our game-loop is to add some state-aware UI. By that I mean, that we should have some UI telling players who have won when a game ends. It would also be nice to indicate which players turn it is and I guess we should at least do something to tell a player that their opponent has left and is not just taking their sweet time with their turn 🐢 Let's start tackling this by changing UI when `game_state.stage` changes:
```rust
fn main() {
    // ...
    App::new()
        // ... 
        .add_system(change_ui_by_stage)
        .run();
}

////////// COMPONENTS //////////
// ...

#[derive(Component)]
struct PlayerHandle(pub u64);

////////// UPDATE SYSTEMS //////////
// ...
fn change_ui_by_stage(
    mut commands: Commands,
    game_state: Res<GameState>,
    mut game_events: EventReader<GameEvent>,
    mut ui_root: Query<(Entity, &mut Style), With<UIRoot>>,
    asset_server: Res<AssetServer>,
) {
    let (ui_root_entity, mut ui_root_style) = ui_root.get_single_mut().unwrap();
    let mut ui_root = commands.entity(ui_root_entity);

    for event in game_events.iter() {
        match event {
            GameEvent::BeginGame { goes_first: _ } => {
                // Remove waiting text when game begins
                ui_root.despawn_descendants();

                // Spawn in game ui
                ui_root_style.justify_content = JustifyContent::SpaceBetween;
                ui_root.with_children(|parent| {
                    for (player_id, player) in game_state.players.iter() {
                        let is_active_player = game_state.active_player_id == *player_id;
                        let is_tac_player = player.piece == store::Tile::Tac;

                        parent
                            .spawn_bundle(TextBundle::from_section(
                                player.name.clone(),
                                TextStyle {
                                    font: asset_server.load("Inconsolata.ttf"),
                                    font_size: 24.0,
                                    color: if !is_active_player {
                                        Color::hex("ebdbb2").unwrap()
                                    } else {
                                        if is_tac_player {
                                            Color::hex("d65d0e").unwrap()
                                        } else {
                                            Color::hex("458488").unwrap()
                                        }
                                    },
                                },
                            ))
                            .insert(PlayerHandle(*player_id));
                    }
                });
            }
            GameEvent::EndGame { reason } => {
                // Despawn in game ui
                ui_root.despawn_descendants();
                ui_root_style.justify_content = JustifyContent::Center;
                match reason {
                    EndGameReason::PlayerLeft { player_id: _ } => {
                        ui_root.with_children(|parent| {
                            parent.spawn_bundle(TextBundle::from_section(
                                "Your opponent has left",
                                TextStyle {
                                    font: asset_server.load("Inconsolata.ttf"),
                                    font_size: 24.0,
                                    color: Color::hex("ebdbb2").unwrap(),
                                },
                            ));
                        });
                    }
                    EndGameReason::PlayerWon { winner } => {
                        ui_root.with_children(|parent| {
                            let winner_player = game_state.players.get(winner).unwrap();
                            let is_tac_player = winner_player.piece == store::Tile::Tac;

                            parent.spawn_bundle(TextBundle::from_section(
                                format!("{} has won!", winner_player.name.clone()),
                                TextStyle {
                                    font: asset_server.load("Inconsolata.ttf"),
                                    font_size: 24.0,
                                    color: if is_tac_player {
                                        Color::hex("d65d0e").unwrap()
                                    } else {
                                        Color::hex("458488").unwrap()
                                    },
                                },
                            ));
                        });
                    }
                }
            }
            _ => {}
        }
    }
}
```
That's a long one! Bevy UI code can get pretty long-winded, but there's a lot of repetition so you do get used to it after a while. We still need to add another update system to highlight the player whose turn it is:
```rust
fn main() {
    // ...
    App::new()
        // ... 
        .add_system(update_in_game_ui)
        .run();
}

////////// UPDATE SYSTEMS //////////
// ...
fn update_in_game_ui(
    game_state: Res<GameState>,
    mut game_events: EventReader<GameEvent>,
    mut player_handles: Query<(&PlayerHandle, &mut Text)>,
) {
    for event in game_events.iter() {
        match event {
            GameEvent::PlaceTile {
                player_id: _,
                at: _,
            } => {
                for (handle, mut text) in player_handles.iter_mut() {
                    let is_active_player = game_state.active_player_id == handle.0;
                    let is_tac_player =
                        game_state.players.get(&handle.0).unwrap().piece == store::Tile::Tac;

                    text.sections[0].style.color = if !is_active_player {
                        Color::hex("ebdbb2").unwrap()
                    } else {
                        if is_tac_player {
                            Color::hex("d65d0e").unwrap()
                        } else {
                            Color::hex("458488").unwrap()
                        }
                    };
                }
            }
            _ => {}
        }
    }
}
```

![Two players playing a game of TicTacTussle](../images/turn-based/finished-client-game.gif)

That's it! That's all! You're done - Congratulations! 🎉 Now venture into the world as a zealot and preacher of the reducer pattern, of bevy and of rust in general! Oh, you want more? Well then:

## I challenge you! 🤺
Maybe you have noticed some missing pieces in our game. I have intentionally cut some corners, to try and focus on the networking parts so I'll leave some of the finishing touches as challenges - Do as many or few as you'd like ✨

- **Challenge 1**: Right now players can place tiles until the board is full. I'm told that most people play tic tac toe with the rule that only three tiles per player are placed onto the board. Implement this rule such that when a player has 3 pieces on the board, the first placed piece gets moved instead of placing a new one.
- **Challenge 2**: Implement some visual indicator of how many pieces each player has left. I think I'd place them underneath the players' names, but maybe there's a better spot for them.
- **Challenge 3**: Implement a way for players to play again once a game has finished. Both players must indicate that they want to have another go for it to happen. If you want to show off, add a counter of how many games each player has won.
- **Challenge 4**: Implement an error screen so that we don't just `panic` crash when there's a connection error.

If you want something a bit harder to work on here are some larger challenges! (These are really more like projects on their own 🤷‍♂️):
- **Project 1**: Add an in-game chat so players can trash-talk each other while they tussle! Have a look at the [renet chat example](https://github.com/lucaspoffo/renet/tree/master/demo_chat) if you need inspiration.
- **Project 2**: Add a "local mode" to the game client where two players take turns on the same computer. This is actually doable without too many modifications, due to our networking layer being pretty simple. The idea is that instead of sending `GameEvent`s to a server, we can intercept and consume them locally instead!

## That's all folks!
Thank you for reading! If you see something that's wrong, I would appreciate it very much if you would [make a pull request](https://github.com/herluf-ba/herluf-ba.github.io/pulls). If you want to talk to me [I'd love to receive an email](mailto:herlufbaggesen13@gmail.com), but I'm also sporadically active on the [Bevy Discord](https://discord.gg/bevy)

##### Actually just one more thing
Even though I tried my best to make snippets readable, I realize that it might sometimes be a bit confusing to read certain parts out of context from the rest. So here is `client/src/main.rs` in its entirety to try and remedy that ✨
```rust
use bevy::prelude::*;
use bevy_renet::{run_if_client_connected, RenetClientPlugin};
use renet::{
    ClientAuthentication, RenetClient, RenetConnectionConfig, RenetError, NETCODE_USER_DATA_BYTES,
};
use std::{net::UdpSocket, time::SystemTime};
use store::{EndGameReason, GameEvent, GameState};

// This id needs to be the same that the server is using
const PROTOCOL_ID: u64 = 1208;

fn main() {
    // Get username from stdin args
    let args = std::env::args().collect::<Vec<String>>();
    let username = &args[1];

    App::new()
        .insert_resource(WindowDescriptor {
            title: format!("TicTacTussle <{}>", username),
            width: 480.0,
            height: 540.0,
            ..default()
        })
        .insert_resource(ClearColor(Color::hex("282828").unwrap()))
        .add_plugins(DefaultPlugins)
        // Renet setup
        .add_plugin(RenetClientPlugin)
        .insert_resource(new_renet_client(&username).unwrap())
        .add_system(handle_renet_error)
        .add_system_to_stage(
            CoreStage::PostUpdate,
            receive_events_from_server.with_run_criteria(run_if_client_connected),
        )
        // Add our game state and register GameEvent as a bevy event
        .insert_resource(GameState::default())
        .add_event::<GameEvent>()
        // Add setup function to spawn UI and board graphics
        .add_startup_system(setup)
        // Add systems for playing TicTacTussle
        .add_system(change_ui_by_stage)
        .add_system(update_waiting_text)
        .add_system(update_in_game_ui)
        .add_system(update_board)
        .add_system(input)
        // Finally we run the thing!
        .run();
}

////////// COMPONENTS //////////
#[derive(Component)]
struct UIRoot;

type TileIndex = usize;
#[derive(Component)]
struct HoverDot(pub TileIndex);

#[derive(Component)]
struct WaitingText;

#[derive(Component)]
struct PlayerHandle(pub u64);

////////// SETUP //////////
fn setup(mut commands: Commands, asset_server: Res<AssetServer>) {
    commands.spawn_bundle(Camera2dBundle::default());

    // Spawn board background
    commands.spawn_bundle(SpriteBundle {
        transform: Transform::from_xyz(0.0, -30.0, 0.0),
        sprite: Sprite {
            custom_size: Some(Vec2::new(480.0, 480.0)),
            ..default()
        },
        texture: asset_server.load("background.png").into(),
        ..default()
    });

    // Spawn a dot in each tile for hover effect
    for x in 0..3 {
        for y in 0..3 {
            commands
                .spawn_bundle(SpriteBundle {
                    transform: Transform::from_xyz(
                        160.0 * (x as f32 - 1.0),
                        -30.0 + 160.0 * (y as f32 - 1.0),
                        0.0,
                    ),
                    sprite: Sprite {
                        color: Color::rgba(1.0, 1.0, 1.0, 0.0),
                        custom_size: Some(Vec2::new(160.0, 160.0)),
                        ..default()
                    },
                    texture: asset_server.load("dot.png").into(),
                    ..default()
                })
                .insert(HoverDot(x + y * 3));
        }
    }

    // Spawn pregame ui
    commands
        // A container that centers its children on the screen
        .spawn_bundle(NodeBundle {
            style: Style {
                position_type: PositionType::Absolute,
                position: UiRect {
                    left: Val::Px(0.0),
                    top: Val::Px(0.0),
                    ..default()
                },
                size: Size::new(Val::Percent(100.0), Val::Px(60.0)),
                align_items: AlignItems::Center,
                justify_content: JustifyContent::Center,
                ..default()
            },
            color: Color::NONE.into(),
            ..default()
        })
        .insert(UIRoot)
        .with_children(|parent| {
            parent
                .spawn_bundle(TextBundle::from_section(
                    "Waiting for an opponent...",
                    TextStyle {
                        font: asset_server.load("Inconsolata.ttf"),
                        font_size: 24.0,
                        color: Color::hex("ebdbb2").unwrap(),
                    },
                ))
                .insert(WaitingText);
        });
}

////////// UPDATE SYSTEMS //////////
fn input(
    windows: Res<Windows>,
    input: Res<Input<MouseButton>>,
    game_state: Res<GameState>,
    mut hover_dots: Query<(&HoverDot, &mut Sprite)>,
    mut client: ResMut<RenetClient>,
) {
    // We only want to handle inputs once we are ingame
    if game_state.stage != store::Stage::InGame {
        return;
    }

    let window = windows.get_primary().unwrap();
    if let Some(mouse_position) = window.cursor_position() {
        // Determine the index of the tile that the mouse is currently over
        let x_tile: usize = (mouse_position.x / 160.0).floor() as usize;
        let y_tile: usize = (mouse_position.y / 160.0).floor() as usize;
        let tile = x_tile + y_tile * 3;

        // If mouse is outside of board we do nothing
        if 8 < tile {
            return;
        }

        // Toggle hover dots on and off
        for (dot, mut dot_sprite) in hover_dots.iter_mut() {
            if dot.0 == tile {
                dot_sprite.color.set_a(1.0);
            } else {
                dot_sprite.color.set_a(0.0);
            }
        }

        // If left mouse button is pressed, send a place tile event to the server
        if input.just_pressed(MouseButton::Left) {
            let event = GameEvent::PlaceTile {
                player_id: client.client_id(),
                at: tile,
            };
            client.send_message(0, bincode::serialize(&event).unwrap());
        }
    }
}

fn update_board(
    mut commands: Commands,
    game_state: Res<GameState>,
    mut game_events: EventReader<GameEvent>,
    asset_server: Res<AssetServer>,
) {
    for event in game_events.iter() {
        match event {
            GameEvent::PlaceTile { player_id, at } => {
                let x = at % 3;
                let y = at / 3;
                let texture =
                    asset_server.load(match game_state.get_player_tile(player_id).unwrap() {
                        store::Tile::Tac => "tac.png",
                        store::Tile::Tic => "tic.png",
                        store::Tile::Empty => "dot.png", // This should never happen
                    });

                commands.spawn_bundle(SpriteBundle {
                    transform: Transform::from_xyz(
                        160.0 * (x as f32 - 1.0),
                        -30.0 + 160.0 * (y as f32 - 1.0),
                        0.0,
                    ),
                    sprite: Sprite {
                        custom_size: Some(Vec2::new(160.0, 160.0)),
                        ..default()
                    },
                    texture: texture.into(),
                    ..default()
                });
            }
            _ => {}
        }
    }
}

fn update_waiting_text(mut text_query: Query<&mut Text, With<WaitingText>>, time: Res<Time>) {
    if let Ok(mut text) = text_query.get_single_mut() {
        let num_dots = (time.time_since_startup().as_secs() % 3) + 1;
        text.sections[0].value = format!(
            "Waiting for an opponent{}{}",
            ".".repeat(num_dots as usize),
            // Pad with spaces to avoid text changing width and dancing all around the screen 🕺
            " ".repeat(3 - num_dots as usize)
        );
    }
}

fn change_ui_by_stage(
    mut commands: Commands,
    game_state: Res<GameState>,
    mut game_events: EventReader<GameEvent>,
    mut ui_root: Query<(Entity, &mut Style), With<UIRoot>>,
    asset_server: Res<AssetServer>,
) {
    let (ui_root_entity, mut ui_root_style) = ui_root.get_single_mut().unwrap();
    let mut ui_root = commands.entity(ui_root_entity);

    for event in game_events.iter() {
        match event {
            GameEvent::BeginGame { goes_first: _ } => {
                // Remove waiting text when game begins
                ui_root.despawn_descendants();

                // Spawn in game ui
                ui_root_style.justify_content = JustifyContent::SpaceBetween;
                ui_root.with_children(|parent| {
                    for (player_id, player) in game_state.players.iter() {
                        let is_active_player = game_state.active_player_id == *player_id;
                        let is_tac_player = player.piece == store::Tile::Tac;

                        parent
                            .spawn_bundle(TextBundle::from_section(
                                player.name.clone(),
                                TextStyle {
                                    font: asset_server.load("Inconsolata.ttf"),
                                    font_size: 24.0,
                                    color: if !is_active_player {
                                        Color::hex("ebdbb2").unwrap()
                                    } else {
                                        if is_tac_player {
                                            Color::hex("d65d0e").unwrap()
                                        } else {
                                            Color::hex("458488").unwrap()
                                        }
                                    },
                                },
                            ))
                            .insert(PlayerHandle(*player_id));
                    }
                });
            }
            GameEvent::EndGame { reason } => {
                // Despawn in game ui
                ui_root.despawn_descendants();
                ui_root_style.justify_content = JustifyContent::Center;
                match reason {
                    EndGameReason::PlayerLeft { player_id: _ } => {
                        ui_root.with_children(|parent| {
                            parent.spawn_bundle(TextBundle::from_section(
                                "Your opponent has left",
                                TextStyle {
                                    font: asset_server.load("Inconsolata.ttf"),
                                    font_size: 24.0,
                                    color: Color::hex("ebdbb2").unwrap(),
                                },
                            ));
                        });
                    }
                    EndGameReason::PlayerWon { winner } => {
                        ui_root.with_children(|parent| {
                            let winner_player = game_state.players.get(winner).unwrap();
                            let is_tac_player = winner_player.piece == store::Tile::Tac;

                            parent.spawn_bundle(TextBundle::from_section(
                                format!("{} has won!", winner_player.name.clone()),
                                TextStyle {
                                    font: asset_server.load("Inconsolata.ttf"),
                                    font_size: 24.0,
                                    color: if is_tac_player {
                                        Color::hex("d65d0e").unwrap()
                                    } else {
                                        Color::hex("458488").unwrap()
                                    },
                                },
                            ));
                        });
                    }
                }
            }
            _ => {}
        }
    }
}

fn update_in_game_ui(
    game_state: Res<GameState>,
    mut game_events: EventReader<GameEvent>,
    mut player_handles: Query<(&PlayerHandle, &mut Text)>,
) {
    for event in game_events.iter() {
        match event {
            GameEvent::PlaceTile {
                player_id: _,
                at: _,
            } => {
                for (handle, mut text) in player_handles.iter_mut() {
                    let is_active_player = game_state.active_player_id == handle.0;
                    let is_tac_player =
                        game_state.players.get(&handle.0).unwrap().piece == store::Tile::Tac;

                    text.sections[0].style.color = if !is_active_player {
                        Color::hex("ebdbb2").unwrap()
                    } else {
                        if is_tac_player {
                            Color::hex("d65d0e").unwrap()
                        } else {
                            Color::hex("458488").unwrap()
                        }
                    };
                }
            }
            _ => {}
        }
    }
}

////////// RENET NETWORKING //////////
fn new_renet_client(username: &String) -> anyhow::Result<RenetClient> {
    let server_addr = "127.0.0.1:5000".parse()?;
    let socket = UdpSocket::bind("127.0.0.1:0")?;
    let current_time = SystemTime::now().duration_since(SystemTime::UNIX_EPOCH)?;
    let client_id = current_time.as_millis() as u64;

    // Place username in user data
    let mut user_data = [0u8; NETCODE_USER_DATA_BYTES];
    if username.len() > NETCODE_USER_DATA_BYTES - 8 {
        panic!("Username is too big");
    }
    user_data[0..8].copy_from_slice(&(username.len() as u64).to_le_bytes());
    user_data[8..username.len() + 8].copy_from_slice(username.as_bytes());

    let client = RenetClient::new(
        current_time,
        socket,
        client_id,
        RenetConnectionConfig::default(),
        ClientAuthentication::Unsecure {
            client_id,
            protocol_id: crate::PROTOCOL_ID,
            server_addr,
            user_data: Some(user_data),
        },
    )?;

    Ok(client)
}

fn receive_events_from_server(
    mut client: ResMut<RenetClient>,
    mut game_state: ResMut<GameState>,
    mut game_events: EventWriter<GameEvent>,
) {
    while let Some(message) = client.receive_message(0) {
        // Whenever the server sends a message we know that it must be a game event
        let event: GameEvent = bincode::deserialize(&message).unwrap();
        trace!("{:#?}", event);

        // We trust the server - It's always been good to us!
        // No need to validate the events it is sending us
        game_state.consume(&event);

        // Send the event into the bevy event system so systems can react to it
        game_events.send(event);
    }
}

// If there's any network error we just panic 🤷‍♂️
// Ie. Client has lost connection to server, if internet is gone or server shut down etc.
fn handle_renet_error(mut renet_error: EventReader<RenetError>) {
    for err in renet_error.iter() {
        panic!("{}", err);
    }
}
```