const assert = require('assert')
const express = require('express')
const a = require('co-express')
const ejs = require('ejs')
const Dat = require('@beaker/dat-node')
const sqlite = require('sqlite')
const mkdirp = require('mkdirp')
const {join} = require('path')
const lock = require('./lock')
const app = express()

const DEBUG_FORUM_NAME = 'Paul\'s Dat Forum'

exports.setup = async function setup (hostname, dataPath) {
  // setup the data folder
  mkdirp.sync(dataPath)
  const dat = Dat.createNode({path: dataPath}) // initiate dat
  const db = await sqlite.open(join(dataPath, 'db.sqlite'), {Promise})
  await db.migrate({migrationsPath: join(__dirname, 'sql')})

  var server = {
    hostname,
    dat,
    db,
    users: null,
    addUser (userData) {
      return addUser(server, userData)
    }
  }

  // swarm all users
  var users = server.users = await db.all('SELECT * FROM User')
  console.log('Swarming', users.length, 'users')
  for (let user of users) {
    await indexUser(db, dat, user)
  }

  // configure app
  app.use(express.json())
  app.engine('html', ejs.renderFile)
  app.engine('ejs', ejs.renderFile)
  app.set('view engine', 'html')
  app.set('views', join(__dirname, '..', 'frontend/html'))
  app.locals = {
    users,
    siteInfo: {
      name: DEBUG_FORUM_NAME,
      hostname: hostname,
      port: 3000
    }
  }
  app.use('/css', express.static(join(__dirname, '..', 'frontend', 'css')))
  app.use('/js', express.static(join(__dirname, '..', 'frontend', 'js')))

  // GET /
  app.get('/', a(async (req, res) => {
    var posts = await db.all(`
      SELECT Post.*, User.name as authorName
        FROM Post
        INNER JOIN User ON Post.authorUrl = User.url
        WHERE threadRootUrl IS NULL
        ORDER BY firstIndexedAt DESC
        LIMIT 20
    `)
    res.format({
      'application/json': () => res.send({posts}),
      'text/html': () => res.render('page-home', {posts})
    })
  }))

  // GET /thread/:id
  app.get('/thread/:threadId', a(async (req, res) => {
    var rootPost = await db.get('SELECT Post.*, User.name as authorName FROM Post INNER JOIN User ON Post.authorUrl = User.url WHERE id=?', [req.params.threadId])
    if (!rootPost) {
      return res.status(404).render('page-notfound')
    }
    var replies = await db.all('SELECT Post.*, User.name as authorName FROM Post INNER JOIN User ON Post.authorUrl = User.url WHERE threadRootUrl=?', rootPost.url)

    res.format({
      'application/json': () => res.send({rootPost, replies}),
      'text/html': () => res.render('page-thread', {rootPost, replies})
    })
  }))

  // GET /users
  app.get('/users', (req, res) => {
    res.format({
      'application/json': () => res.send({users}),
      'text/html': () => res.render('page-users', {users})
    })
  })

  // GET /user
  //   ?name=...
  //   ?url=...
  app.get('/user', (req, res) => {
    var user
    if (req.query.name) {
      let name = req.query.name.toLowerCase()
      user = users.find(user => user.name === name)
    } else if (req.query.url) {
      let url = req.query.url.toLowerCase()
      user = users.find(user => user.url === url)
    }
    if (!user) {
      return res.status(404).render('page-notfound')
    }
    res.format({
      'application/json': () => res.send({user}),
      'text/html': () => res.render('page-user', {user})
    })
  })

  // POST /users
  app.post('/users', a(async (req, res) => {
    try {
      await addUser(server, req.body)
      res.send({success: true})
    } catch (e) {
      res.status(400).send({error: e.toString()})
    }
  }))

  // listen
  app.listen(3000, () => console.log(DEBUG_FORUM_NAME, 'listening on port 3000'))

  return server
}

async function addUser (server, userData) {
  assert(userData.name && typeof userData.name === 'string', 'name is required')
  assert(userData.url && typeof userData.url === 'string', 'url is required')

  var {db, users} = server
  var release = await lock('users') // we need a transaction to correctly reserve the username
  try {
    var {name, url} = userData

    // check if the name is available
    var existingUser = await db.get(`SELECT * FROM User WHERE name=?`, [name])
    if (existingUser) throw new Error('Username is already in use')

    // add to db
    var values = {url, name, isAdmin: 0, createdAt: Date.now()}
    db.run(`INSERT INTO User (${NAMES(values)}) VALUES (${QS(values)})`, Object.values(values))
    users.push(values)

    // index
    await indexUser(server, userData)
  } finally {
    release()
  }
}

async function indexUser (server, user) {
  var {dat, hostname} = server
  user.archive = await dat.getArchive(user.url)
  // index current posts
  var files = await user.archive.readdir('/posts/' + hostname)
  for (let file of files) {
    await indexPost(server, user, '/posts/' + hostname + '/' + file)
  }
  // watch for subsequent updates
  user.archive.watch('/posts/' + hostname + '/*.json', e => indexPost(server, user, e.path))
}

async function indexPost (server, user, path) {
  var {db} = server
  var url = user.url + path
  var release = await lock(user.url) // index one post on a user at a time
  try {
    // read post
    var indexedAt = Date.now()
    var post = JSON.parse(await user.archive.readFile(path, 'utf8'))

    // validate
    assert(post && typeof post === 'object', 'Post must be an object')
    assert(!post.title || typeof post.title === 'string', 'Post .title must be a string')
    assert(typeof post.body === 'string' && post.body, 'Post .body is required and must be a string')
    assert(!post.threadRootUrl || typeof post.threadRootUrl === 'string', 'Post .threadRootUrl must be a string')
    assert(!post.threadParentUrl || typeof post.threadParentUrl === 'string', 'Post .threadParentUrl must be a string')

    // store
    let values = {
      url,
      authorUrl: user.url,
      threadRootUrl: post.threadRootUrl,
      threadParentUrl: post.threadParentUrl,

      title: post.title,
      body: post.body,

      firstIndexedAt: indexedAt,
      lastIndexedAt: indexedAt
    }
    var postRecord = await db.get('SELECT * FROM Post WHERE url=?', [url])
    if (postRecord) {
      values.firstIndexedAt = postRecord.firstIndexedAt
      await db.run(`UPDATE Post ${SET(values)} WHERE url=?`, [...Object.values(values), url])
    } else {
      await db.run(`INSERT OR IGNORE INTO Post (${NAMES(values)}) VALUES (${QS(values)})`, Object.values(values))
    }
  } catch (e) {
    console.error('Failed to index post by', user.name)
    console.error('Post URL:', url)
    console.error(e)
  } finally {
    release()
  }
}

function SET (obj) {
  var valuesClause = Object.keys(obj).map(key => `${key}=?`)
  return `SET ${valuesClause.join(', ')}`
}

function NAMES (obj) {
  return Object.keys(obj).join(', ')
}

function QS (obj) {
  return Object.keys(obj).map(_ => '?').join(', ')
}
