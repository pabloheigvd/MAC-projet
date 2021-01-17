const neo4j = require('neo4j-driver');

class GraphDAO {
  constructor() {
    this.driver = neo4j.driver(`bolt://${process.env.GRAPHDB_HOST}`);
  }

  prepare() {
    return new Promise((resolve) => {
      this.run('CREATE CONSTRAINT ON (n:Movie) ASSERT n.id IS UNIQUE', {}).then(() => {
        this.run('CREATE CONSTRAINT ON (u:User) ASSERT u.id IS UNIQUE', {}).then(() => resolve());
      });
    });
  }

  close() {
    return this.driver.close();
  }

  upsertUser(user) {
    return this.run(`
      MERGE (u:User {id: $userId})
      ON CREATE SET u.isBot = $isBot,
                    u.firstName = $firstName,
                    u.lastName = $lastName,
                    u.username = $username,
                    u.personaname = $personaname,
                    u.accountId = $accountId
      ON MATCH SET  u.isBot = $isBot,
                    u.firstName = $firstName,
                    u.lastName = $lastName,
                    u.username = $username,
                    u.personaname = $personaname,
                    u.accountId = $accountId
    `, {
      userId: this.toInt(user.id),
      firstName: user.first_name,
      lastName: user.last_name,
      username: user.username,
      isBot: user.is_bot,
      personaname: user.personaname,
      accountId: user.accountId,
    });
  }

  upsertUserFollowed(userId, followedUsername) {
    return this.run(`
      MATCH (f:User {username: $followedUsername})
        MERGE (u:User {id: $userId})
        MERGE (u)-[r:FOLLOW]->(f)
    `, {
      userId,
      followedUsername,
    });
  }

  deleteUserFollowing(userId, followedUsername) {
    return this.run(`
      MATCH (a:User{id: $userId})-[r:FOLLOW]->(b:User{username: $followedUsername}) 
      DELETE r
    `, {
      userId,
      followedUsername,
    });
  }

  getFriends(userId) {
    return this.run('MATCH (:User{id: $userId})-[l:FOLLOW]->(u:User) RETURN u', {
      userId,
    }).then((res) => {
      if (res.records.length === 0) return null;

      return res.records.map((record) => record.get('u').properties);
    });
  }

  toDate(value) {
    return neo4j.types.DateTime.fromStandardDate(value);
  }

  toInt(value) {
    return neo4j.int(value);
  }

  run(query, params) {
    const session = this.driver.session();
    return new Promise((resolve) => {
      session.run(query, params).then((result) => {
        session.close().then(() => resolve(result));
      });
    });
  }
}

module.exports = GraphDAO;
