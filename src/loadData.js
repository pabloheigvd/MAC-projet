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
