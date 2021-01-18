# Telegram Dota bot - MAC-2020 - HEIG-VD

*Students : Bonzon Ludovic, Mercado Pablo & Vaz Afonso Vitor*

## Introduction

Our bot comes in **Javascript** flavor on Nodejs. The JS code is located in `/src`. It uses both **Neo4j** and **
MongoDB** for data persistence.

The goal of this bot is to bring users in a Telegram group closer when it comes to the Dota game. With our bot, you can
track recent players activity, socialize with your friends and stay up-to-date on latest heroes' trends amongst your
friends and game mates.

## Deploying

We'll first take care of deploying on your computer. This bot uses both **Neo4j** and **MongoDB** for data persistance.
We provide a `docker-compose.yml` file for your convenience.

### Using Docker

If you want to use Docker, make sure it is installed on your machine, and then run `docker-compose up` to start both
Mongodb and Neo4j.

### Filling some users data

- Create a `.env` file based on the `.env.exemple` provided file and fill in `DOCUMENTDB_HOST` and `GRAPHDB_HOST`.
- To fill in some data, we provide a script which loads some users to ease the following process:
    - In javascript (`/src/loadData.js`), run `npm run import` to make it run.

### Registering the bot

You first have to register it on Telegram, for this follow the [documentation](https://core.telegram.org/bots).

- Register your bot on BotFather
- Register these commands:
    - `help` - Provides some help to use the bot
    - `playeractivity` - Display infos on the 5 latest matches of a player
    - `linkaccount` - Link your Telegram account to a Dota account
    - `followplayer` - To follow a user in the Telegram group
    - `unfollowplayer` - To unfollow a user in the Telegram group
    - `showfollowings` - Show the list of the currently followed users and their personananme
    - `recommendhero` - Get a personalized hero recommendation
    - Use inline queries to display a telegram user, then use the inline keyboard of the resulting message to
      follow/unfollow.
- run `/setinline` and `/setinlinefeedback` for the bot to be able to answer inline queries
- copy the token the botfather gave you and go to `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates`
  to enable active polling on your bot. Don't forget to replace `<YOUR_TOKEN>` by your actual token

### Running your bot

To run the bot in javascript:

- In javascript (`/src/index.js`) run `npm start`
  This will make the bot run in active polling mode, which means the bot will reply to your commands, as well as inline
  queries.

### Summary

```bash
# first terminal
docker-compose up -V

# second terminal
cd src/
npm run import
npm start
```

## Known issues

- We have a **refresh issue on the inline keyboard** when using **inline queries to (un)follow players**, as the
  following state doesn't update to reflect the correct follow state of a user, which can create a bit of confusion.
  Using regular commands such as `/followplayer`, `/unfollowplayer` and `/showfollowings` is the best option. Inline
  queries were developed more as a proof of concept for now.