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

bot.command('help', (ctx) => {
  ctx.reply(`
A little help to use our Dota Bot for the project given in the MAC course at the HEIG-VD.

A user can link its Telegram account to a Dota account via its personaname. Then users in a Telegram group can follow
and unfollow each other.
When asked, the bot will provide a recommendation based on the most played heroes among its friends.

Use /playeractivity <personaname OR accountId> to display infos on the 5 latest matches of a player
Use /linkaccount <personaname> to link your Telegram account to a Dota account
Use /followplayer <Telegram username> to follow a user in the Telegram group
Use /unfollowplayer <Telegram username> to unfollow a user in the Telegram group
Use /showplayers to show the list of the currently followed users and their personananme
Use inline queries to display a telegram user, then use the inline keyboard of the resulting message to follow/unfollow.
Use the command /recommendhero to get a personalized recommendation.
  `);
});

/**
 * Réagit à la commande start et affiche un message de bienvenue
 */
bot.command('start', (ctx) => {
  ctx.reply('Dota Bot in Javascript for HEIG-VD MAC-2020 course');
});

/**
 * Fonction pour obtenir l'accountId d'un joueur Dota (nécessaire pour faire les calls à l'API OpenDota)
 * @param personaname nom du joueur Dota
 * @returns {Promise<*>}
 */
async function getAccountId(personaname) {
  const searchUrl = `https://api.opendota.com/api/search?q=${personaname}`;

  const resp = await fetch(searchUrl);
  const data = await resp.json();
  return data[0].account_id; // account_id du premier user uniquement (certains joueurs ont le même nom)
}

/**
 * Fonction pour obtenir des données sur les 20 derniers matches d'un joueur via son Dota accountId
 * @param accountId ID du compte du joueur Dota
 * @returns {Promise<*>}
 */
async function getRecentMatchData(accountId) {
  const recentMatchesUrl = `https://api.opendota.com/api/players/${accountId}/recentMatches`;

  const resp = await fetch(recentMatchesUrl);
  return await resp.json();
}

/**
 * Fonction qui retourne le nom d'un joueur Dota à partir de son accountId
 * @param accountId ID du compte du joueur Dota
 * @returns {Promise<*>}
 */
async function getPlayerName(accountId) {
  const playerName = `https://api.opendota.com/api/players/${accountId}`;
  const resp = await fetch(playerName);
  return await resp.json();
}

/**
 * Formate les données de match pour l'affichage dans un message Telegram
 * @param matchData
 * @returns {{text: string, win: number}}
 */
function formatMatchData(matchData) {
  const matchID = matchData.match_id;
  const playerSlot = matchData.player_slot; // Which slot the player is in. 0-127 are Radiant, 128-255 are Dire
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

  const text = `[Match link](https://www.opendota.com/matches/${matchID})\n` +
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

/**
 * Réagit à une demande d'activité récente d'un joueur Dota
 * Usage : /playeractivity <personaname OR accountId>
 */
bot.command('playeractivity', (ctx) => {
  // Récupère la commande et parse le paramètre (personaname = nom du joueur)
  const msgText = ctx.message.text;
  const arguments = msgText.split(' ');
  let personName;
  if (arguments.length > 1 && arguments[1] != null) {
    personName = arguments[1];
  } else {
    ctx.reply("You need to specify a player name to get its recent activity (/playeractivity <personaname OR accountId>)");
    return;
  }

  getAccountId(personName).then((accountId) => {
    getRecentMatchData(accountId).then((recentMatchesData) => {
      getPlayerName(accountId).then((personFullName) => {
        let personaname = personFullName.profile.personaname;
        let person = `[${personaname}](https://www.opendota.com/players/${accountId})`;
        const NB_MATCHES = 5;
        let output = "";
        let wins = 0;

        // N'affiche que les NB_MATCHES premiers matches
        for (let i = 0; i < NB_MATCHES; ++i) {
          const match = formatMatchData(recentMatchesData[i]);
          output += match.text;
          wins += match.win;
        }
        output += `${person} has won ${wins}/${NB_MATCHES} of his recent matches`;

        ctx.reply(text = `Last ${NB_MATCHES} matches activity for ${person} :\n${output}`, {parse_mode: 'markdown'});
      });
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
  if (arguments.length === 2) {
    personaname = arguments[1];
  } else {
    ctx.reply("Usage is '/linkaccount <personaname>'");
    return;
  }

  getAccountId(personaname).then(accountId => {
    let user = {
      first_name: 'unknown',
      last_name: 'unknown',
      is_bot: false,
      username: 'unknown',
      ...ctx.from,
      personaname,
      accountId,
    }

    // Insère l'utilisateur dans la DB Graph
    graphDAO.upsertUser(user).then(() => {
      ctx.reply(`Telegram user ${ctx.from.username} has been registered with dota account ${personaname}`);
    });

    // Enregistre aussi l'utilisateur sur MongoDB (pour pouvoir utiliser DocumentDAO.getRegisteredUsers() )
    documentDAO.insertUser(user);
  });
});

/**
 * Réagit à la commande pour suivre un compte Telegram associé à un compte Dota
 * Usage : /followplayer <Telegram username>
 */
bot.command('followplayer', (ctx) => {
  // Récupère la commande et parse le paramètre (telegramUsername)
  const msgText = ctx.message.text;
  const arguments = msgText.split(' ');
  let telegramUsername;
  if (arguments.length === 2) {
    telegramUsername = arguments[1];
  } else {
    ctx.reply("Usage is '/followplayer <Telegram username>'");
    return;
  }

  // Enregistre la relation FOLLOWING entre 2 utilisateurs Telegram
  graphDAO.upsertUserFollowed(ctx.from.id, telegramUsername).then(() => {
    ctx.reply(`You are now following Telegram user ${telegramUsername} !` + Emojis.faceStars);
  })

  // TODO : Nice to have - afficher sous forme d'inline query comportant uniquement les utilisateurs du groupe enregistrés
});

/**
 * Réagit à la commande pour arrêter de suivre un compte Telegram associé à un compte Dota
 * Usage : /unfollowplayer <Telegram username>
 */
bot.command('unfollowplayer', (ctx) => {
  // Récupère la commande et parse le paramètre (telegramUsername)
  const msgText = ctx.message.text;
  const arguments = msgText.split(' ');
  let telegramUsername;
  if (arguments.length === 2) {
    telegramUsername = arguments[1];
  } else {
    ctx.reply("Usage is '/unfollowplayer <Telegram username>'");
    return;
  }

  // Supprime la relation FOLLOWING entre 2 utilisateurs Telegram
  graphDAO.deleteUserFollowing(ctx.from.id, telegramUsername).then(() => {
    ctx.reply(`${telegramUsername} is not your friend anymore` + Emojis.faceCrying);
  })
});

/**
 * Réagit à la commande permettant d'afficher les amis suivis et leur personaname Dota
 * Usage : /showfollowings
 */
bot.command('showfollowings', (ctx) => {
  graphDAO.getFriends(ctx.from.id).then((friends) => {
    let friendsList = '';
    friends.forEach(friend => {
      friendsList += '  - ' + friend.username + ' aka ' + friend.personaname + '\n';
    })

    ctx.reply(`Here's your friends list :\n${friendsList}`)
  })
});

/**
 * Réagit à l'utilisation de inline queries ('@<nom du bot> <requête ...>')
 * Les résultats proposés sont sous la forme :
 * <Telegram username>\n
 * <personaname du joueur>
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
          `,
        },
      }));
      ctx.answerInlineQuery(answer);
    });
  }
});

/**
 * Function to build a "follow/unfollow" keyboard for friends
 * @param username
 * @param isFollowed
 * @returns {{inline_keyboard: [[{text: string, callback_data: string}]]}}
 */
function buildFollowKeyboard(username, isFollowed) {
  return {
    inline_keyboard: [
      [
        {
          text: !isFollowed ? "Follow ❤ " : "Unfollow 💔 ",
          callback_data: !isFollowed ? `follow__${username}` : `unfollow__${username}`
        },
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
      })
    } else if (type === "unfollow") { // Supprime la relation FOLLOW dans le graphe
      graphDAO.deleteUserFollowing(ctx.from.id, username).then(() => {
        ctx.editMessageReplyMarkup(buildFollowKeyboard(username, false));
      })
    }
  }
});

/**
 * Réagit à l'appel de la commande de recommendation de héro Dota sur la base de l'utilisation récente de nos amis
 */
bot.command('recommendhero', (ctx) => {
  if (ctx.from) {
    // Obtient les amis de premier niveau
    graphDAO.getFriends(ctx.from.id).then((friend) => {
      if (friend !== null) {
        let map = new Map();
        // Ajoute les amis de premier niveau au set
        friend.map((x) => map.set(x.id.low, x));

        // Obtient les amis de second niveau
        let friendsRelationship = friend.map((x) => graphDAO.getFriends(x.id.low).then((secondFriend) => {
          if (secondFriend != null) {
            return secondFriend.map((y) => y);
          }
        }))

        // Ajoute tous les amis de 2ème niveau au set
        Promise.all(friendsRelationship).then(x => x.filter(y => y !== undefined).map(z => {
          z.map(v => map.set(v.id.low, v));
        })).then(() => {
            let heroesToRecommend = [];

            // Parcourt tous les amis
            let ps = [];
            map.forEach((user) => {
              let p = getRecentMatchData(user.accountId);
              ps.push(p);
            });

            // Obtient tous les matches
            Promise.all(ps).then(playerMatches => {
              playerMatches = playerMatches.flat();
              let heroIds = {};

              // Obtient tous les IDs des héros utilisés lors des matches
              playerMatches = playerMatches.map(m => m.hero_id);
              playerMatches.forEach(id => {
                if (typeof heroIds[id] === 'undefined') {
                  heroIds[id] = 1;
                } else {
                  heroIds[id]++;
                }
              });

              // Trie les héros par fréquence d'apparition décroissante
              let sortable = [];
              for (let hero in heroIds) {
                sortable.push([hero, heroIds[hero]]);
              }
              sortable.sort(function (a, b) {
                return b[1] - a[1];
              });

              // Limite le résultat à 5 héros
              sortable = sortable.map(x => x[0]);
              heroesToRecommend = [];
              for (let i = 0; i < 5; i++) {
                const hero = Heroes.heroes[sortable[i] - 2];
                heroesToRecommend.push(hero.localized_name);
              }

              //Affiche le résultat à l'utilisateur
              let answer = "The recommended heroes are:\n";
              heroesToRecommend.forEach(v => answer += "- " + v + "\n");
              answer += "\n\nHeroes were selected among your friend's (and friends of friends) most played"

              ctx.reply(answer);
            });
          }
        )
      } else {
        ctx.reply("You currently do not have any friends. Add some with the inline query or the /followplayer command");
      }
    });
  }
})

// Initialize mongo connexion
// before starting bot
documentDAO.init().then(() => {
  bot.startPolling();
});
