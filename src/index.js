const dotenv = require('dotenv');
const Telegraf = require('telegraf');
const fetch = require('node-fetch');
const DocumentDAO = require('./DocumentDAO');
const GraphDAO = require('./GraphDAO');
const Emojis = require("./constants/emojis.js");
const Heroes = require("./constants/heroes.js");

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

async function getPlayerName(accountId) {
  const playerName = `https://api.opendota.com/api/players/${accountId}`;
  const resp = await fetch(playerName);
  return await resp.json();
}

// source: https://apps.timwhitlock.info/emoji/tables/unicode
// take Unicode value


function formatMatchData(matchData) {
  const matchID = matchData.match_id;
  // https://docs.opendota.com/#tag/players%2Fpaths%2F~1players~1%7Baccount_id%7D~1recentMatches%2Fget
  // Which slot the player is in. 0-127 are Radiant, 128-255 are Dire
  const playerSlot = matchData.player_slot;
  const radiantWin = matchData.radiant_win;
  const {duration} = matchData;
  const {hero_id} = matchData;
  const {kills} = matchData;
  const {deaths} = matchData;
  const {assists} = matchData;
  const xpPerMin = matchData.xp_per_min;
  const goldPerMin = matchData.gold_per_min;
  const heroDamage = matchData.hero_damage;
  const towerDamage = matchData.tower_damage;
  const heroHealing = matchData.hero_healing;
  const lastHits = matchData.last_hits;

  const isPlayerRadiant = playerSlot < 128;
  const hasPlayerWon = (isPlayerRadiant && radiantWin) || (!isPlayerRadiant && !radiantWin)
  const winLose = hasPlayerWon ? "won" : "lost";
  const winner = radiantWin ? "radiant" : "dire";

  const hero = Heroes.heroes.find(e => e.id === hero_id);

  const text = `[Match link](https://www.opendota.com/matches/${matchID})\n`+
      Emojis.cup + winLose + ` as ${winner}\n` +
      Emojis.player + ` played as ${hero.localized_name}\n` +
      Emojis.feed + ` K/D/A : ${kills}/${deaths}/${assists}\n` +
      Emojis.expDiamond + ` XP per min : ${xpPerMin}\n` +
      Emojis.moneyBag + ` Gold per min : ${goldPerMin}\n` +
      Emojis.target + ` Hero damage : ${heroDamage}\n` +
      Emojis.castle + ` Tower damage : ${towerDamage}\n` +
      Emojis.pill + ` Hero healing : ${heroHealing}\n` +
      Emojis.coin + ` Last hits : ${lastHits}\n` +
      Emojis.time + ` Duration : ${duration}\n---\n`;

  return {text: text, win: hasPlayerWon ? 1 : 0};
}

bot.command('playeractivity', (ctx) => {
  // Récupère la commande et parse le paramètre (personaname = nom du joueur)
  const msgText = ctx.message.text;
  const arguments = msgText.split(' ');
  let personName;
  // https://www.opendota.com/players/103367483
  // using the numbers here works
  if (arguments.length > 1 && arguments[1] != null) {
    personName = arguments[1];
  } else {
    ctx.reply("Vous devez préciser le nom d'un joueur pour obtenir son activité récente (/playeractivity <steam32 id>)");
    return;
  }

  getAccountId(personName).then((accountId) => {
    getRecentMatchData(accountId).then((recentMatchesData) => {
      getPlayerName(accountId).then((personFullName) => {
        let personaname = personFullName.profile.personaname;
        let person = `[${personaname}](https://www.opendota.com/players/${accountId})`;
        const NB_MATCHES = 5;
        var output = "";
        var wins = 0;
        for (let i = 0; i < NB_MATCHES; ++i) {
          const match = formatMatchData(recentMatchesData[i]);
          output += match.text;
          wins += match.win;
        }
        output += `${person} has won ${wins}/${NB_MATCHES} of his recent matches`;

        // note: * bold * works
        ctx.reply(text=`Last ${NB_MATCHES} matches activity for ${person} :\n${output}`, {parse_mode: 'markdown'});
      });
    });
  });
});

// Initialize mongo connexion
// before starting bot
documentDAO.init().then(() => {
  bot.startPolling();
});
