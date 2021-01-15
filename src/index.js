const dotenv = require('dotenv');
const Telegraf = require('telegraf');
const fetch = require('node-fetch');
const DocumentDAO = require('./DocumentDAO');
const GraphDAO = require('./GraphDAO');

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN);
const graphDAO = new GraphDAO();
const documentDAO = new DocumentDAO();

function stripMargin(template, ...expressions) {
  const result = template.reduce((accumulator, part, i) => accumulator + expressions[i - 1] + part);
  return result.replace(/(\n|\r|\r\n)\s*\|/g, '$1');
}

/*
// FIXME : DELETE -> Adapté pour Dota
function buildLikeKeyboard(movieId, currentLike) {
  return {
    inline_keyboard: [
      [1, 2, 3, 4, 5].map((v) => ({
        text: currentLike && currentLike.rank === v ? '★'.repeat(v) : '☆'.repeat(v),
        callback_data: `${v}__${movieId}`, // payload that will be retrieved when button is pressed
      })),
    ],
  };
}*/

/*
// FIXME : DELETE -> Adapté pour Dota
// User is using the inline query mode on the bot
bot.on('inline_query', (ctx) => {
  const query = ctx.inlineQuery;
  if (query) {
    documentDAO.getMovies(query.query).then((movies) => {
      const answer = movies.map((movie) => ({
        id: movie._id,
        type: 'article',
        title: movie.title,
        description: movie.description,
        reply_markup: buildLikeKeyboard(movie._id),
        input_message_content: {
          message_text: stripMargin`
            |Title: ${movie.title}
            |Description: ${movie.description},
            |Year: ${movie.year}
            |Actors: ${movie.actors}
            |Genres: ${movie.genre}
          `,
        },
      }));
      ctx.answerInlineQuery(answer);
    });
  }
});*/

/*
// TODO : nécessaire ?
// User chose a movie from the list displayed in the inline query
// Used to update the keyboard and show filled stars if user already liked it
bot.on('chosen_inline_result', (ctx) => {
  if (ctx.from && ctx.chosenInlineResult) {
    graphDAO.getMovieLiked(ctx.from.id, ctx.chosenInlineResult.result_id).then((liked) => {
      if (liked !== null) {
        ctx.editMessageReplyMarkup(buildLikeKeyboard(ctx.chosenInlineResult.result_id, liked));
      }
    });
  }
});
*/

/*
// FIXME : DELETE -> Adapté pour Dota
bot.on('callback_query', (ctx) => {
  if (ctx.callbackQuery && ctx.from) {
    const [rank, movieId] = ctx.callbackQuery.data.split('__');
    const liked = {
      rank: parseInt(rank, 10),
      at: new Date(),
    };

    graphDAO.upsertMovieLiked({
      first_name: 'unknown',
      last_name: 'unknown',
      language_code: 'fr',
      is_bot: false,
      username: 'unknown',
      ...ctx.from,
    }, movieId, liked).then(() => {
      ctx.editMessageReplyMarkup(buildLikeKeyboard(movieId, liked));
    });
  }
});*/

bot.command('help', (ctx) => {
  ctx.reply(`
A demo for the project given in the MAC course at the HEIG-VD.

A user can display a movie and set a reaction to this movie (like, dislike).
When asked, the bot will provide a recommendation based on the movies he liked or disliked.

Use inline queries to display a movie, then use the inline keyboard of the resulting message to react.
Use the command /recommendactor to get a personalized recommendation.
  `);
});

bot.command('start', (ctx) => {
  ctx.reply('HEIG-VD Mac project example bot in javascript');
});

bot.command('recommendactor', (ctx) => {
  if (!ctx.from || !ctx.from.id) {
    ctx.reply('We cannot guess who you are');
  } else {
    graphDAO.recommendActors(ctx.from.id).then((records) => {
      if (records.length === 0) ctx.reply("You haven't liked enough movies to have recommendations");
      else {
        const actorsList = records.map((record) => {
          const {name} = record.get('a').properties;
          const count = record.get('count(*)').toInt();
          return `${name} (${count})`;
        }).join('\n\t');
        ctx.reply(`Based your like and dislike we recommend the following actor(s):\n\t${actorsList}`);
      }
    });
  }
});

async function getAccountId(personaname) {
  const searchUrl = `https://api.opendota.com/api/search?q=${personaname}`;

  const resp = await fetch(searchUrl);
  const data = await resp.json();
  return data[0].account_id; // TODO : account_id du premier user uniquement, voir si possibilité de proposer une liste de choix (users avec le même nom)
}

async function getRecentMatchData(accountId) {
  const recentMatchesUrl = `https://api.opendota.com/api/players/${accountId}/recentMatches`;

  const resp = await fetch(recentMatchesUrl);
  return await resp.json();
}

function formatMatchData(matchData) {
  const matchID = matchData.match_id;
  const playerSlot = matchData.player_slot;
  const radiantWin = matchData.radiant_win;
  const {duration} = matchData;
  const {kills} = matchData;
  const {deaths} = matchData;
  const {assists} = matchData;
  const xpPerMin = matchData.xp_per_min;
  const goldPerMin = matchData.gold_per_min;
  const heroDamage = matchData.hero_damage;
  const towerDamage = matchData.tower_damage;
  const heroHealing = matchData.hero_healing;
  const lastHits = matchData.last_hits;
  // TODO : Ajouter les données utiles
  /*
                    duration: 1104,
                    game_mode: 23,
                    lobby_type: 0,
                    hero_id: 34,
                    start_time: 1609008639,
                    version: null,
                    kills: 5,
                    deaths: 0,
                    assists: 11,
                    skill: 1,
                    xp_per_min: 1743,
                    gold_per_min: 1156,
                    hero_damage: 20682,
                    tower_damage: 95,
                    hero_healing: 0,
                    last_hits: 116,
                    lane: null,
                    lane_role: null,
                    is_roaming: null,
                    cluster: 136,
                    leaver_status: 0,
                    party_size: 2
            */

  return `Match ID : ${matchID} 
Player Slot : ${playerSlot} 
Radiant win : ${radiantWin}
Duration : ${duration}
Kills : ${kills}
Deaths : ${deaths}
Assists : ${assists}
XP per min. : ${xpPerMin}
Gold per min. : ${goldPerMin}
Hero damage : ${heroDamage}
Tower damage : ${towerDamage}
Hero healing : ${heroHealing}
Last hits : ${lastHits}
Duration : ${duration}\n\n`;
}

bot.command('playeractivity', (ctx) => {
  // Récupère la commande et parse le paramètre (personaname = nom du joueur)
  const msgText = ctx.message.text;
  const arguments = msgText.split(' ');
  let personaname;
  if (arguments[1] != null) {
    personaname = arguments[1];
  } else {
    ctx.reply("Vous devez préciser le nom d'un joueur pour obtenir son activité récente (/playeractivity <nom du joueur>)");
  }

  let recentMatchData = '';

  getAccountId(personaname).then((accountId) => {
    getRecentMatchData(accountId).then((recentMatchesData) => {
      // console.log(recentMatchesData);

      const NB_MATCHES = 5;
      for (let i = 0; i < NB_MATCHES; ++i) {
        recentMatchData += formatMatchData(recentMatchesData[i]);
      }
      // console.log(recentMatchData);

      ctx.reply(`Last ${NB_MATCHES} matches activity for ${personaname} :\n${recentMatchData}`);
    });
  });
});

/**
 * Réagit à la commande pour lier le compte Telegram au compte Dota (personaname)
 * Usage : /linkaccount <personaname>
 */
bot.command('linkaccount', (ctx) => {
  // Récupère la commande et parse le paramètre (personaname = nom du joueur)
  const msgText = ctx.message.text;
  const arguments = msgText.split(' ');
  let personaname;
  if (arguments[1] != null) {
    personaname = arguments[1];
  }

  let user = {
    first_name: 'unknown',
    last_name: 'unknown',
    is_bot: false,
    username: 'unknown',
    ...ctx.from,
    personaname,
  }

  // Insère l'utilisateur dans la DB Graph
  graphDAO.upsertUser(user).then(() => {
    ctx.reply(`Telegram user ${ctx.from.username} has been registered with dota account ${personaname}`);
  });

  // Enregistre aussi l'utilisateur sur MongoDB (pour pouvoir utiliser DocumentDAO.getRegisteredUsers() )
  documentDAO.insertUser(user);
});

/**
 * Réagit à la commande pour suivre un compte Telegram associé à un compte Dota
 */
// FIXME : DELETE -> Fait avec les inline queries
bot.command('followplayer', (ctx) => {
  // Récupère la commande et parse le paramètre (telegramUsername)
  const msgText = ctx.message.text;
  const arguments = msgText.split(' ');
  let telegramUsername;
  if (arguments[1] != null) {
    telegramUsername = arguments[1];
  }

  // Enregistre la relation FOLLOWING entre 2 utilisateurs Telegram
  graphDAO.upsertUserFollowed(ctx.from.id, telegramUsername).then(() => {
    ctx.reply(`You are now following Telegram user ${telegramUsername} !`);
  })

  // TODO : Improve, afficher sous forme d'inline query comportant uniquement les utilisateurs du groupe enregistrés
});

bot.command('recommendhero', (ctx) => {

  //Get friends
  //graphDAO.select
  if (ctx.from) {
    graphDAO.getFriends(ctx.from.id).then((friend) => {
      //if (friend !== null) {
      //  console.log(friend.record)
      //  ctx.reply(`You are friend with Telegram user ${friend} !`);
      //}
      if (friend !== null) {
        for (i = 0; i < friend.record.length; ++i){
          console.log(friend.record[i].get('u'));
          ctx.reply(`You are friend with Telegram user ${friend.record[i].get('u').properties.username}  !`); //${friend[i].name}
        }
      }else{
        ctx.reply(friend);
      }
    });
  }
  /*
    if (ctx.from) {
    graphDAO.getFriends(ctx.from.id).then((friend) => {
      if (friend !== null) {
        for (i = 0; i < friend.length; ++i){
          ctx.reply(`You are friend with Telegram user ${friend[i].name} !`);
        }
      }else{
        ctx.reply(friend);
      }
    });
   */

});

/**
 * Réagit à l'utilisation de inline queries ('@<nom du bot> <requête ...>')
 * Les résultats proposés sont sous la forme :
 * <Initiale du nom d'utilisateur Telegram> <Telegram username>\n
 *                                          <personaname du joueur>
 */
bot.on('inline_query', (ctx) => {
  const query = ctx.inlineQuery;
  if (query) {
    // Récupère les utilisateurs enregistrés dans MongoDB
    documentDAO.getRegisteredUsers(query.query).then((users) => {
      const answer = users.map((user) => ({
        id: user._id,
        type: 'article', // Type de résultat inline query affiché (https://core.telegram.org/bots/api#inlinequeryresult)
        title: user.username, // Titre affiché dans la inline query
        description: `Dota username : ` + user.personaname, // Description affichée dans la inline query
        reply_markup: buildFollowKeyboard(user.username),
        input_message_content: {
          message_text: stripMargin`
            |Selected user :
            |Telegram username: ${user.username}
            |Dota personaname: ${user.personaname}
          `, // TODO : Afficher + de stats sur le compte ?
        },
      }));
      ctx.answerInlineQuery(answer);
    });
  }
});

function buildFollowKeyboard(username, isFollowed) {
  return {
    inline_keyboard: [
      [
        {
          text: !isFollowed ? "Follow ❤ " : "Unfollow 💔 ",
          callback_data: !isFollowed ? `follow__${username}` : `unfollow__${username}`
        },// TODO : Afficher 3 boutons au callback : "follow ❤", "unfollow 💔" et "Recommend hero" ? */
      ]
    ],
  };
}

bot.on('callback_query', (ctx) => {
  if (ctx.callbackQuery && ctx.from) {
    const [type, username] = ctx.callbackQuery.data.split('__');

    if (type === "follow") {
      // Enregistre la relation FOLLOW entre 2 utilisateurs Telegram
      graphDAO.upsertUserFollowed(ctx.from.id, username).then(() => {
        ctx.editMessageReplyMarkup(buildFollowKeyboard(username, true));
        // TODO : Trouver un moyen pour afficher une confirmation de un/follow ou modifier le message existant
        //ctx.reply(`You are now following Telegram user ${username} !`);
      })
    } else if (type === "unfollow") { // Supprime la relation FOLLOW dans le grapge
      graphDAO.deleteUserFollowing(ctx.from.id, username).then(() => {
        ctx.editMessageReplyMarkup(buildFollowKeyboard(username, false));
      })
    }
  }
});

// Initialize mongo connexion
// before starting bot
documentDAO.init().then(() => {
  bot.startPolling();
});
