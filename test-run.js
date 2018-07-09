const tempy = require('tempy')
const {setup} = require('./backend')

main()
async function main () {
  var hostname = 'localhost'
  var dataPath = tempy.directory()
  var server = await setup(hostname, dataPath)

  console.log('generate test users')
  var [alice, bob, carla] = await Promise.all([
    server.dat.createArchive({title: 'Alice', description: 'Test user for pauls-dat-forum', type: ['user-profile']}),
    server.dat.createArchive({title: 'Bob', description: 'Test user for pauls-dat-forum', type: ['user-profile']}),
    server.dat.createArchive({title: 'Carla', description: 'Test user for pauls-dat-forum', type: ['user-profile']})
  ])

  console.log('create their directory structures')
  async function createFolders (archive) {
    await archive.mkdir('/posts')
    await archive.mkdir(`/posts/${hostname}`)
  }
  await Promise.all([
    createFolders(alice),
    createFolders(bob),
    createFolders(carla)
  ])

  console.log('write a few threads')
  var _n = 1
  async function writePost (archive, post) {
    var path = `/posts/${hostname}/${_n++}.json`
    await archive.writeFile(path, JSON.stringify(post))
    return archive.url + path
  }
  var thread1 = await writePost(alice, {title: 'Hello, world!', body: 'How well is this forum working?'})
  var thread1reply1 = await writePost(bob, {title: 'RE: Hello, world!', body: 'Hi Alice!', threadRootUrl: thread1, threadParentUrl: thread1})
  var thread1reply2 = await writePost(carla, {title: 'RE: Hello, world!', body: 'Hi Alice and Bob!', threadRootUrl: thread1, threadParentUrl: thread1reply1})
  var thread2 = await writePost(alice, {title: 'Hello, world!', body: 'How well is this forum working?'})
  var thread2reply1 = await writePost(bob, {title: 'RE: Hello, world!', body: 'Hi Alice!', threadRootUrl: thread2, threadParentUrl: thread2})
  var thread2reply2 = await writePost(carla, {title: 'RE: Hello, world!', body: 'Hi Alice and Bob!', threadRootUrl: thread2, threadParentUrl: thread2reply1})

  console.log('add users')
  await server.addUser({name: 'alice', url: alice.url})
  await server.addUser({name: 'bob', url: bob.url})
  await server.addUser({name: 'carla', url: carla.url})

  console.log('ready! explore at localhost:3000')
}