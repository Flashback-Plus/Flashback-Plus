// content.js — Flashback Plus (MV3, Firefox+Chromium via webextension-polyfill)

// ---------- Konstanta nycklar ----------
const KEY_THREADS_HIDDEN = "hiddenFlashbackThreads";     // [string id]
const KEY_THREADS_MARKED = "markedFlashbackThreads";     // [string id]
const KEY_POSTS_HIDDEN   = "fbHiddenPosts";              // [string postId]
const KEY_POSTS_LIKED    = "fbInterestingPosts";         // [string postId]
const KEY_USERS_IGNORED  = "fbIgnoredUsers";             // [string username]
const KEY_LIGHT_IGNORED  = "fbLightIgnored";             // { threadKey: [username] }

// ---------- Hjälpare: Storage (Promise-baserat) ----------
async function getStore(keys) {
  return browser.storage.local.get(keys);
}
async function setStore(obj) {
  return browser.storage.local.set(obj);
}
async function removeStore(keys) {
  return browser.storage.local.remove(keys);
}

// Enkla getters/setters
async function getHiddenThreads()      { return (await getStore(KEY_THREADS_HIDDEN))[KEY_THREADS_HIDDEN] || []; }
async function setHiddenThreads(v)     { return setStore({ [KEY_THREADS_HIDDEN]: v }); }

async function getMarkedThreads()      { return (await getStore(KEY_THREADS_MARKED))[KEY_THREADS_MARKED] || []; }
async function setMarkedThreads(v)     { return setStore({ [KEY_THREADS_MARKED]: v }); }

async function getHiddenPosts()        { return (await getStore(KEY_POSTS_HIDDEN))[KEY_POSTS_HIDDEN] || []; }
async function setHiddenPosts(v)       { return setStore({ [KEY_POSTS_HIDDEN]: v }); }

async function getLikedPosts()         { return (await getStore(KEY_POSTS_LIKED))[KEY_POSTS_LIKED] || []; }
async function setLikedPosts(v)        { return setStore({ [KEY_POSTS_LIKED]: v }); }

async function getIgnoredUsers()       { return (await getStore(KEY_USERS_IGNORED))[KEY_USERS_IGNORED] || []; }
async function setIgnoredUsers(v)      { return setStore({ [KEY_USERS_IGNORED]: v }); }

async function getLightIgnoredMap()    { return (await getStore(KEY_LIGHT_IGNORED))[KEY_LIGHT_IGNORED] || {}; }
async function setLightIgnoredMap(obj) { return setStore({ [KEY_LIGHT_IGNORED]: obj }); }

// ---------- URL & tråd-nyckel ----------
function getThreadKeyFromUrl(url = location.href) {
  // Matchar /t123, /s456, /p789, ev. med p2 osv. Normaliserar till t123, s456, p789
  const m = url.match(/\/([tsp])(\d+)/);
  return m ? (m[1] + m[2]) : null;
}

// ---------- UI-helpers ----------
function styleInlineButton(el, opts = {}) {
  Object.assign(el.style, {
    marginRight: '1px',
    marginLeft:  '1px',
    background:  '#cccccc6e',
    color:       '#515151',
    border:      'none',
    padding:     '3px 6px',
    cursor:      'pointer',
    borderRadius:'3px',
    fontSize:    '12px',
    ...opts
  });
}

function styleActionLink(a) {
  Object.assign(a.style, {
    background:    '#cccccc6e',
    color:         '#515151',
    border:        'none',
    padding:       '3px 6px',
    borderRadius:  '3px',
    fontSize:      '12px',
    marginLeft:    '1px',
    textDecoration:'none',
    display:       'inline-block',
    marginTop:     '-4px'
  });
}

// ---------- Applicera regler på inlägg ----------
function applyIgnoredUsersToPosts(ignoredUsers) {
  document.querySelectorAll('[data-postid]').forEach(post => {
    const usernameEl = post.querySelector('.post-user-username');
    const username = usernameEl?.textContent?.trim();
    if (username && ignoredUsers.includes(username)) {
      post.style.display = 'none';
    }
  });
}

function applyLightIgnoredToCurrentThread(lightMap) {
  const threadKey = getThreadKeyFromUrl();
  if (!threadKey) return;
  const list = lightMap[threadKey] || [];
  if (!list.length) return;

  document.querySelectorAll('[data-postid]').forEach(post => {
    const username = post.querySelector('.post-user-username')?.textContent?.trim();
    if (username && list.includes(username)) post.style.display = 'none';
  });
}

function applyPostState(postId, post, likedPosts, hiddenPosts) {
  const postContent = post.querySelector('.post-col.post-right');
  if (hiddenPosts.includes(postId)) {
    post.style.display = 'none';
  }
  if (likedPosts.includes(postId) && postContent) {
    postContent.style.backgroundColor = '#c1ffd6';
    postContent.style.color = '#000';
  }
}

// ---------- Knappar på inlägg ----------
async function addButtonsToPosts() {
  const [hiddenPosts, likedPosts, ignoredUsers, lightMap] = await Promise.all([
    getHiddenPosts(), getLikedPosts(), getIgnoredUsers(), getLightIgnoredMap()
  ]);

  document.querySelectorAll('[data-postid]').forEach(post => {
    const postId = post.getAttribute('data-postid');
    if (!postId) return;

    // Undvik dubletter
    if (post.querySelector('.fb-hide-btn') ||
        post.querySelector('.fb-like-btn') ||
        post.querySelector('.fb-ignore-btn') ||
        post.querySelector('.fb-lightignore-btn')) {
      return;
    }

    applyPostState(postId, post, likedPosts, hiddenPosts);

    // Hitta "Rapportera"-länken
    const reportLink = Array.from(post.querySelectorAll('a'))
      .find(a => a.textContent.trim() === "Rapportera");
    if (!reportLink) return;

    // Style på Flashbacks egna knappar
    ["Rapportera", "Citera", "Citera+"].forEach(txt => {
      const link = Array.from(post.querySelectorAll('a')).find(a => a.textContent.trim() === txt);
      if (link) styleActionLink(link);
    });

    // Dölj-knapp
    const hideBtn = document.createElement('button');
    hideBtn.textContent = 'Dölj';
    hideBtn.className = 'fb-hide-btn';
    styleInlineButton(hideBtn);
    hideBtn.addEventListener('click', async () => {
      const curHidden = await getHiddenPosts();
      if (!curHidden.includes(postId)) {
        curHidden.push(postId);
        await setHiddenPosts(curHidden);
      }
      post.style.display = 'none';
    });

    // Gilla/Ogilla
    const likeBtn = document.createElement('button');
    likeBtn.className = 'fb-like-btn';
    const isLiked = likedPosts.includes(postId);
    likeBtn.textContent = isLiked ? 'Ogilla' : 'Gilla';
    styleInlineButton(likeBtn, {
      background: isLiked ? 'orange' : '#c1ffd6',
      color: '#000'
    });
    likeBtn.addEventListener('click', async () => {
      const curLiked = await getLikedPosts();
      const idx = curLiked.indexOf(postId);
      const postContent = post.querySelector('.post-col.post-right');

      if (idx !== -1) {
        curLiked.splice(idx, 1);
        await setLikedPosts(curLiked);
        likeBtn.textContent = 'Gilla';
        likeBtn.style.background = '#c1ffd6';
        if (postContent) { postContent.style.backgroundColor = ''; postContent.style.color = ''; }
      } else {
        curLiked.push(postId);
        await setLikedPosts(curLiked);
        likeBtn.textContent = 'Ogilla';
        likeBtn.style.background = 'orange';
        if (postContent) { postContent.style.backgroundColor = '#c1ffd6'; postContent.style.color = '#000'; }
      }
    });

    // Ignorera (permanent)
    const ignoreBtn = document.createElement('button');
    ignoreBtn.textContent = 'Ignorera';
    ignoreBtn.className = 'fb-ignore-btn';
    styleInlineButton(ignoreBtn);
    ignoreBtn.addEventListener('click', async () => {
      const usernameEl = post.querySelector('.post-user-username');
      const username = usernameEl?.textContent?.trim();
      if (!username) return;

      const curIgnored = await getIgnoredUsers();
      if (!curIgnored.includes(username)) {
        curIgnored.push(username);
        await setIgnoredUsers(curIgnored);
      }
      // Applicera direkt
      applyIgnoredUsersToPosts(curIgnored);
      applyIgnoredUsersToThreads(curIgnored);
    });

    // Light-ignore (per tråd)
    const lightBtn = document.createElement('button');
    lightBtn.textContent = 'Ignorera i tråden';
    lightBtn.className = 'fb-lightignore-btn';
    styleInlineButton(lightBtn);
    lightBtn.addEventListener('click', async () => {
      const usernameEl = post.querySelector('.post-user-username');
      const username = usernameEl?.textContent?.trim();
      const threadKey = getThreadKeyFromUrl();
      if (!username || !threadKey) {
        alert("Light-ignora fungerar endast på tråd-/s-/p-sidor.");
        return;
      }
      const curMap = await getLightIgnoredMap();
      curMap[threadKey] = curMap[threadKey] || [];
      if (!curMap[threadKey].includes(username)) {
        curMap[threadKey].push(username);
        await setLightIgnoredMap(curMap);
      }
      applyLightIgnoredToCurrentThread(curMap);
    });

    // Infoga knappar (före Rapportera)
    reportLink.parentNode.insertBefore(likeBtn, reportLink);
    reportLink.parentNode.insertBefore(hideBtn, reportLink);
    reportLink.parentNode.insertBefore(lightBtn, reportLink);
    reportLink.parentNode.insertBefore(ignoreBtn, reportLink);

    // Se till att “Citera+”/“Citera” hamnar efter Rapportera
    const citeraPlusLink = Array.from(post.querySelectorAll('a')).find(a => a.textContent.trim() === "Citera+");
    const citeraLink     = Array.from(post.querySelectorAll('a')).find(a => a.textContent.trim() === "Citera");
    if (citeraPlusLink) reportLink.parentNode.insertBefore(citeraPlusLink, reportLink.nextSibling);
    if (citeraLink) {
      if (citeraPlusLink) reportLink.parentNode.insertBefore(citeraLink, citeraPlusLink.nextSibling);
      else reportLink.parentNode.insertBefore(citeraLink, reportLink.nextSibling);
    }
  });

  // Applicera ignore-regler efter insert
  applyIgnoredUsersToPosts(ignoredUsers);
  applyLightIgnoredToCurrentThread(lightMap);
}

// ---------- Trådlistor (forum-sidan) ----------
function applyIgnoredUsersToThreads(ignoredUsers) {
  document.querySelectorAll('span[style*="cursor:pointer"]').forEach(el => {
    const username = el.textContent.trim();
    if (ignoredUsers.includes(username)) {
      const row = el.closest("tr");
      if (row) row.style.display = 'none';
    }
  });
}

function hideThreadRowById(id) {
  const row = document.getElementById("td_title_" + id)?.closest("tr");
  if (row) row.style.display = 'none';
}

async function addButtonsToThreads() {
  const [hiddenIds, markedIds, ignoredUsers] = await Promise.all([
    getHiddenThreads(), getMarkedThreads(), getIgnoredUsers()
  ]);

  document.querySelectorAll("td.td_title[id^='td_title_']").forEach(tdTitle => {
    const id = tdTitle.id.replace("td_title_", "");
    const row = tdTitle.closest("tr");
    if (!row || tdTitle.querySelector(".hide-thread-btn")) return;

    const hideBtn = document.createElement("button");
    hideBtn.textContent = "Dölj permanent";
    hideBtn.className = "hide-thread-btn";
    Object.assign(hideBtn.style, {
      position: "absolute",
      right: "5px",
      top: "50%",
      transform: "translateY(-50%)",
      fontSize: "10px",
      padding: "2px 5px",
      cursor: "pointer",
      background: "#cccccc6e",
      color: "#515151",
      border: "none",
      borderRadius: "3px"
    });
    hideBtn.addEventListener("click", async () => {
      const curHidden = await getHiddenThreads();
      if (!curHidden.includes(id)) {
        curHidden.push(id);
        await setHiddenThreads(curHidden);
      }
      hideThreadRowById(id);
    });

    const markBtn = document.createElement("button");
    const isMarked = markedIds.includes(id);
    markBtn.textContent = isMarked ? "Ogilla" : "Gilla";
    markBtn.className   = "mark-thread-btn";
    Object.assign(markBtn.style, {
      position: "absolute",
      right: "85px",
      top: "50%",
      transform: "translateY(-50%)",
      fontSize: "10px",
      padding: "2px 5px",
      cursor: "pointer",
      background: isMarked ? "orange" : "#c1ffd6",
      color: "#000",
      border: "none",
      borderRadius: "3px"
    });
    markBtn.addEventListener("click", async () => {
      let curMarked = await getMarkedThreads();
      if (curMarked.includes(id)) {
        curMarked = curMarked.filter(x => x !== id);
        row.style.backgroundColor = "";
        markBtn.textContent = "Gilla";
        markBtn.style.background = "#c1ffd6";
      } else {
        curMarked.push(id);
        row.style.backgroundColor = "#c1ffd6";
        markBtn.textContent = "Ogilla";
        markBtn.style.background = "orange";
      }
      await setMarkedThreads(curMarked);
    });

    tdTitle.style.position = "relative";
    tdTitle.appendChild(markBtn);
    tdTitle.appendChild(hideBtn);

    if (isMarked) row.style.backgroundColor = "#9cf5ba";
  });

  hiddenIds.forEach(id => hideThreadRowById(id));
  applyIgnoredUsersToThreads(ignoredUsers);
}

// ---------- Init/Observer ----------
const url = location.href;

async function initForPostPages() {
  await addButtonsToPosts();
}

async function initForForumPages() {
  await addButtonsToThreads();
}

// Debounce för observer
let reflowTimer = null;
function scheduleReapply(fn) {
  if (reflowTimer) clearTimeout(reflowTimer);
  reflowTimer = setTimeout(fn, 150);
}

if (/\/(t|s|p)/.test(url)) {
  initForPostPages();
  const observer = new MutationObserver(() => scheduleReapply(initForPostPages));
  observer.observe(document.body, { childList: true, subtree: true });
} else if (/\/f/.test(url)) {
  initForForumPages();
  const observer = new MutationObserver(() => scheduleReapply(initForForumPages));
  observer.observe(document.body, { childList: true, subtree: true });
}

// ---------- Messaging till/från popup ----------
browser.runtime.onMessage.addListener(async (message) => {
  // EXPORT_POSTS: popup vill exportera post-/user-/light-ignore-data
  if (message?.type === "EXPORT_POSTS") {
    const [postsHidden, postsInteresting, usersIgnored, lightIgnored] = await Promise.all([
      getHiddenPosts(), getLikedPosts(), getIgnoredUsers(), getLightIgnoredMap()
    ]);
    return { postsHidden, postsInteresting, usersIgnored, lightIgnored };
  }

  // IMPORT_POSTS: popup importerar en dump; skriv över respektive nycklar
  if (message?.type === "IMPORT_POSTS") {
    const ops = [];
    if (Array.isArray(message.postsHidden))      ops.push(setHiddenPosts(message.postsHidden));
    if (Array.isArray(message.postsInteresting)) ops.push(setLikedPosts(message.postsInteresting));
    if (Array.isArray(message.usersIgnored))     ops.push(setIgnoredUsers(message.usersIgnored));
    if (message.lightIgnored && typeof message.lightIgnored === 'object') {
      ops.push(setLightIgnoredMap(message.lightIgnored));
    }
    await Promise.all(ops);

    // Reapplicera i aktuell vy
    if (/\/(t|s|p)/.test(location.href)) {
      await addButtonsToPosts();
    } else if (/\/f/.test(location.href)) {
      await addButtonsToThreads();
    }
    return { success: true };
  }

  // REMOVE_LIGHT_IGNORE: popup ber oss ta bort en (threadKey, username)
  if (message?.type === "REMOVE_LIGHT_IGNORE") {
    const { threadKey, username } = message;
    if (!threadKey || !username) return { success: false };

    const map = await getLightIgnoredMap();
    if (Array.isArray(map[threadKey])) {
      map[threadKey] = map[threadKey].filter(u => u !== username);
      if (map[threadKey].length === 0) delete map[threadKey];
      await setLightIgnoredMap(map);
      if (getThreadKeyFromUrl() === threadKey) {
        applyLightIgnoredToCurrentThread(map);
      }
      return { success: true };
    }
    return { success: false };
  }
});

