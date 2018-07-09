import {$, $$, render, safe} from 'dat://pauls-uikit.hashbase.io/js/dom.js'

var userName = localStorage.userName
var userUrl = localStorage.userUrl
var isCreatingUser = false
var isComposing = false
var userArchive

main()

async function main () {
  if (userUrl && userName) {
    userArchive = new DatArchive(userUrl)
    try {
      var replyComposer = $('.reply-composer')
      replyComposer.classList.add('visible')
      replyComposer.addEventListener('submit', onSubmitReply)
    } catch (e) {}
  }
  renderHeaderTools()
}

function renderHeaderTools () {
  var el = $('.header-tools')
  el.innerHTML = ''

  if (typeof DatArchive === 'undefined') {
    el.append(render(`
      <div class="beaker-notice"><strong>Read-only mode.</strong><br/>Visit with a <a href="https://beakerbrowser.com">dat-based browser</a> to participate.</div>
    `))
    return
  }

  if (userArchive && userName) {
    el.append(render(`
      <div><a class="new-thread-btn" href="#">new thread</a> | <a href="/user?name=${encodeURIComponent(safe(userName))}">${safe(userName)}</a></div>
    `))
    el.querySelector('.new-thread-btn').addEventListener('click', onNewThread)
  } else {
    el.append(render(`
      <div><a class="create-user-btn" href="#">new user</a></div>
    `))
    el.querySelector('.create-user-btn').addEventListener('click', onCreateUser)
  }

  if (isCreatingUser) {
    el.append(render(`
      <form class="create-user">
        <div>
          <label for="user-name-input">Username:</label>
          <input id="user-name-input" type="text" autofocus />
          <button type="submit">Create</button>
          <a href="#" class="create-user-cancel-btn">cancel</a>
        </div>
      </form>
    `))
    el.querySelector('.create-user').addEventListener('submit', onSubmitUser)
    el.querySelector('.create-user-cancel-btn').addEventListener('click', onCancelCreateUser)
  }
}

function renderComposer () {
  var el = $('.composer-container')
  el.innerHTML = ''

  if (!isComposing) {
    return
  }

  el.append(render(`
    <form class="composer">
      <div>
        <input id="title-input" type="text" autofocus placeholder="Title" />
      </div>
      <div>
        <textarea id="body-input"></textarea>
      </div>
      <div class="actions">
        <button type="submit">Post thread</button>
        <a class="composer-cancel-btn" href="#">cancel</a>
      </div>
    </form>
  `))

  el.querySelector('.composer').addEventListener('submit', onSubmitComposer)
  el.querySelector('.composer-cancel-btn').addEventListener('click', onCancelComposer)
}

async function onSubmitComposer (e) {
  e.preventDefault()

  var title = safe($('.composer #title-input').value)  
  var body = safe($('.composer #body-input').value)

  // write post
  await userArchive.writeFile(`/posts/localhost/${Date.now()}.json`, JSON.stringify({title, body}))

  // refresh
  if (window.location.pathname === '/') {
    window.location.reload()
  } else {
    isComposing = false
    renderComposer()
  }
}

async function onSubmitReply (e) {
  e.preventDefault()

  var threadRootUrl = safe($('.reply-composer #thread-root-url-input').value)
  var threadParentUrl = safe($('.reply-composer #thread-parent-url-input').value)
  var title = safe($('.reply-composer #title-input').value)  
  var body = safe($('.reply-composer #body-input').value)

  // write post
  await userArchive.writeFile(`/posts/localhost/${Date.now()}.json`, JSON.stringify({title, body, threadRootUrl, threadParentUrl}))

  // refresh
  window.location.reload()
}

async function onSubmitUser (e) {
  e.preventDefault()

  var name = safe($('#user-name-input').value)

  // create the archive if needed
  var title = `${name} (Pauls Dat Forum User)`
  if (!userArchive) {
    userArchive = await DatArchive.create({
      title,
      description: 'User created by pauls-dat-forum',
      type: 'user-profile'
    })
  } else {
    userArchive.configure({title})
  }
  try {
    await userArchive.mkdir('/posts')
    await userArchive.mkdir('/posts/localhost')
  } catch (e) {}

  // add to the forum
  var reqBody = {name, url: userArchive.url}
  var res = await fetch('/users', {method: 'POST', headers: {"Content-Type": "application/json; charset=utf-8"}, body: JSON.stringify(reqBody)})
  var resBody = await res.json()

  // handle error
  if (resBody.error) {
    try { $('.create-user .error').remove() } catch (e) {}
    $('.create-user').append(render(`<div class="error">${safe(resBody.error)}</div>`))
    return
  }

  // save on success
  localStorage.userName = name
  localStorage.userUrl = userArchive.url
  window.location.reload()
}

function onCreateUser (e) {
  e.preventDefault()
  isCreatingUser = true
  renderHeaderTools()
}

function onCancelCreateUser (e) {
  e.preventDefault()
  isCreatingUser = false
  renderHeaderTools()
}

function onNewThread (e) {
  e.preventDefault()
  isComposing = true
  renderComposer()
}

function onCancelComposer (e) {
  e.preventDefault()
  isComposing = false
  renderComposer()
}