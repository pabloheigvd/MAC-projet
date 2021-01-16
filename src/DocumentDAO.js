const { MongoClient } = require('mongodb');

class DocumentDAO {
  constructor() {
    this.client = null;
    this.db = null;
    this.collection = null;
  }

  init() {
    return new Promise((resolve) => {
      MongoClient.connect(`mongodb://root:toor@${process.env.DOCUMENTDB_HOST}/?authSource=admin`, (err, client) => {
        if (err !== null) throw err;
        this.client = client;
        this.db = client.db(process.env.DOCUMENTDB_NAME);
        this.collection = this.db.collection('mac2020');
        resolve(null);
      });
    });
  }

  close() {
    return this.client.close();
  }

  insertMovie(movie) {
    return this.collection.insertOne(movie);
  }

  insertUser(user) {
    return this.collection.updateOne({ username: user.username },
      {
        $set:
          {
            id: user.id,
            is_bot: user.is_bot,
            first_name: user.first_name,
            last_name: user.last_name,
            username: user.username,
            personaname: user.personaname,
            accountId: user.accountId,
          },
      }, { upsert: true });
  }

  getMovies(search) {
    return this.collection.find({ title: new RegExp(search) }).limit(10).toArray();
  }

  getRegisteredUsers(search) {
    return this.collection.find({ username: new RegExp(search) }).limit(10).toArray();
  }

  getMovieById(id) {
    return this.collection.findOne({ _id: id });
  }

  getRandomMovies(n) {
    return this.collection.find().limit(n).toArray();
  }

  getAllMovies() {
    return this.collection.find().toArray().then((result) => result.map((it) => ({
      ...it,
      _id: it._id.toString(),
    })));
  }
}

module.exports = DocumentDAO;
