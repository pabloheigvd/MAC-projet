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

function buildLikeKeyboard(movieId, currentLike) {
  return {
    inline_keyboard: [
      [1, 2, 3, 4, 5].map((v) => ({
        text: currentLike && currentLike.rank === v ? '★'.repeat(v) : '☆'.repeat(v),
        callback_data: `${v}__${movieId}`, // payload that will be retrieved when button is pressed
      })),
    ],
  };
}

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
});

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
});

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

// source: https://apps.timwhitlock.info/emoji/tables/unicode
// take Unicode value
const moneyBag = "\u{1F4B0}";

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
    XP per min. : ${xpPerMin}` +
    moneyBag + `Gold per min. : ${goldPerMin}
    Hero damage : ${heroDamage}
    Tower damage : ${towerDamage}
    Hero healing : ${heroHealing}
    Last hits : ${lastHits}
    Duration : ${duration}\n\n`;
}

bot.command('playeractivity', (ctx) => {
  // TODO better formatting
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

// Initialize mongo connexion
// before starting bot
documentDAO.init().then(() => {
  bot.startPolling();
});
