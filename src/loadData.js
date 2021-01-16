const dotenv = require('dotenv');
const parse = require('csv-parse');
const fs = require('fs').promises;
const cliProgress = require('cli-progress');
const { join } = require('path');

const DocumentDAO = require('./DocumentDAO');
const GraphDAO = require('./GraphDAO');

dotenv.config();

const buildUser = (id, username, first_name, last_name, language_code, is_bot, personaname, accountId) => ({
  id,
  username,
  first_name,
  last_name,
  language_code,
  is_bot,
  personaname,
  accountId,
});

const shuffle = (array) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * i);
    const temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }

  return array;
};

const parseMovies = () => new Promise((resolve) => {
  fs.readFile(join(__dirname, '../data/movies.csv')).then((baseMovies) => {
    parse(baseMovies, (err, data) => {
      resolve(data);
    });
  });
});

const users = [
  buildUser(220987852, 'ovesco', 'guillaume', 'hochet', 'fr', false, 'alpha', 368737282),
  buildUser(136451861, 'thrudhvangr', 'christopher', 'meier', 'fr', false, 'bravo', 152919179),
  buildUser(136451862, 'NukedFace', 'marcus', 'nuked', 'fr', false, 'charlie', 85094755),
  buildUser(136451863, 'lauralol', 'laura', 'laura', 'fr', false, 'delta', 175301418),
  buildUser(136451864, 'Saumonlecitron', 'jean-michel', 'citron', 'fr', false, 'echo', 136946553),
];

const graphDAO = new GraphDAO();
const documentDAO = new DocumentDAO();

console.log('Starting mongo');
documentDAO.init().then(() => {
  console.log('Preparing Neo4j');
  graphDAO.prepare().then(() => {
    console.log('Writing users to neo4j');
    Promise.all(users.map((user) => {
      graphDAO.upsertUser(user);
      documentDAO.insertUser(user);
    })).then(() => {
    });
  });
});
