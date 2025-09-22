// content.js - updated with Light-ignore feature

// --- Storage setup ---
const storage = browser.storage.local;
const storageKeyHidden = "hiddenFlashbackThreads";
const storageKeyMarked = "markedFlashbackThreads";

// --- POSTS FUNCTIONS ---
function getHiddenPosts() {
  return JSON.parse(storage.local.getItem('fbHiddenPosts') || '[]');
}
function saveHiddenPosts(hiddenIds) {
  storage.local.setItem('fbHiddenPosts', JSON.stringify(hiddenIds));
}
function getInterestingPosts() {
  return JSON.parse(storage.local.getItem('fbInterestingPosts') || '[]');
}
function saveInterestingPosts(ids) {
  storage.local.setItem('fbInterestingPosts', JSON.stringify(ids));
}

// --- IGNORED USERS (permanent) ---
function getIgnoredUsers() {
  return JSON.parse(storage.local.getItem('fbIgnoredUsers') || '[]');
}
function saveIgnoredUsers(usernames) {
  storage.local.setItem('fbIgnoredUsers', JSON.stringify(usernames));
}
function applyIgnoredUsers() {
  const ignored = getIgnoredUsers();
  document.querySelectorAll('[data-postid]').forEach(post => {
    const usernameEl = post.querySelector('.post-user-username');
    if (!usernameEl) return;
    const username = usernameEl.textContent.trim();
    if (username && ignored.includes(username)) post.style.display = 'none';
  });
}
function applyIgnoredUsersToThreads() {
  const ignored = getIgnoredUsers();
  document.querySelectorAll('span[style*="cursor:pointer"]').forEach(el => {
    const username = el.textContent.trim();
    if (ignored.includes(username)) {
      const row = el.closest("tr");
      if (row) row.style.display = 'none';
    }
  });
}

// --- LIGHT-IGNORED USERS (per-thread) ---
// stored shape: { "<threadKey>": ["user1","user2"], ... }
function getLightIgnored() {
  try {
    return JSON.parse(storage.local.getItem('fbLightIgnored') || '{}');
  } catch (e) {
    return {};
  }
}
function saveLightIgnored(obj) {
  storage.local.setItem('fbLightIgnored', JSON.stringify(obj));
}
function addLightIgnore(threadKey, username) {
  if (!threadKey || !username) return;
  const all = getLightIgnored();
  all[threadKey] = all[threadKey] || [];
  if (!all[threadKey].includes(username)) {
    all[threadKey].push(username);
    saveLightIgnored(all);
  }
}
function removeLightIgnore(threadKey, username) {
  const all = getLightIgnored();
  if (!all[threadKey]) return;
  all[threadKey] = all[threadKey].filter(u => u !== username);
  if (all[threadKey].length === 0) delete all[threadKey];
  saveLightIgnored(all);
}
function getThreadKeyFromUrl(url = location.href) {
  // For /t1234567, /t1234567p2, /s1234, /s1234p2, /p1234, /p1234p2 etc
  // We normalize to e.g. "t1234567", "s1234", "p1234"
  const m = url.match(/\/([tsp])(\d+)/);
  if (m) return m[1] + m[2];
  return null;
}
function applyLightIgnoredToCurrentThread() {
  const threadKey = getThreadKeyFromUrl();
  if (!threadKey) return;
  const all = getLightIgnored();
  const list = all[threadKey] || [];
  if (!list.length) return;
  document.querySelectorAll('[data-postid]').forEach(post => {
    const usernameEl = post.querySelector('.post-user-username');
    if (!usernameEl) return;
    const username = usernameEl.textContent.trim();
    if (username && list.includes(username)) post.style.display = 'none';
  });
}

// --- POST STATE APPLY ---
function applyPostState(postId, post) {
  const hiddenPosts = getHiddenPosts();
  const interestingPosts = getInterestingPosts();
  const postContent = post.querySelector('.post-col.post-right');

  if (hiddenPosts.includes(postId)) post.style.display = 'none';
  if (interestingPosts.includes(postId) && postContent) {
    postContent.style.backgroundColor = '#c1ffd6';
    postContent.style.color = '#000';
  }
}

// Add buttons to posts
function addButtonsToPosts() {
  const hiddenPosts = getHiddenPosts();
  const interestingPosts = getInterestingPosts();

  document.querySelectorAll('[data-postid]').forEach(post => {
    const postId = post.getAttribute('data-postid');
    applyPostState(postId, post);

    if (post.querySelector('.fb-hide-btn') || post.querySelector('.fb-interest-btn') || post.querySelector('.fb-ignore-btn') || post.querySelector('.fb-lightignore-btn')) return;

    const reportLink = Array.from(post.querySelectorAll('a')).find(a => a.textContent.trim() === "Rapportera");
    if (!reportLink) return;

    // --- Style Rapportera, Citera, Citera+ ---
    ["Rapportera", "Citera", "Citera+"].forEach(txt => {
      const link = Array.from(post.querySelectorAll('a')).find(a => a.textContent.trim() === txt);
      if (link) Object.assign(link.style, {
        background: '#cccccc6e',
        color: '#515151',
        border: 'none',
        padding: '3px 6px',
        borderRadius: '3px',
        fontSize: '12px',
        marginLeft: '1px',
        textDecoration: 'none',
        display: 'inline-block',
        marginTop: '-4px'
      });
    });

    // --- Hide button ---
    const hideBtn = document.createElement('button');
    hideBtn.textContent = 'Dölj';
    hideBtn.className = 'fb-hide-btn';
    Object.assign(hideBtn.style, {
      marginRight: '1px',
      marginLeft: '1px',
      background: '#cccccc6e',
      color: '#515151',
      border: 'none',
      padding: '3px 6px',
      cursor: 'pointer',
      borderRadius: '3px',
      fontSize: '12px',
    });
    hideBtn.addEventListener('click', () => {
      post.style.display = 'none';
      if (!hiddenPosts.includes(postId)) {
        hiddenPosts.push(postId);
        saveHiddenPosts(hiddenPosts);
      }
    });

    // --- Gilla button ---
    const interestBtn = document.createElement('button');
    const isInteresting = interestingPosts.includes(postId);
    interestBtn.textContent = isInteresting ? 'Ogilla' : 'Gilla';
    interestBtn.className = 'fb-interest-btn';
    Object.assign(interestBtn.style, {
      marginRight: '1px',
      background: isInteresting ? 'orange' : '#c1ffd6',
      color: '#000',
      border: 'none',
      padding: '3px 6px',
      cursor: 'pointer',
      borderRadius: '3px',
      fontSize: '12px',
    });
    interestBtn.addEventListener('click', () => {
      const postContent = post.querySelector('.post-col.post-right');
      if (!postContent) return;

      const interestingPostsCurrent = getInterestingPosts();
      const idx = interestingPostsCurrent.indexOf(postId);

      if (idx !== -1) {
        interestingPostsCurrent.splice(idx, 1);
        saveInterestingPosts(interestingPostsCurrent);
        interestBtn.textContent = 'Gilla';
        interestBtn.style.background = '#c1ffd6';
        postContent.style.backgroundColor = '';
        postContent.style.color = '';
      } else {
        interestingPostsCurrent.push(postId);
        saveInterestingPosts(interestingPostsCurrent);
        interestBtn.textContent = 'Ogilla';
        interestBtn.style.background = 'orange';
        postContent.style.backgroundColor = '#c1ffd6';
        postContent.style.color = '#000';
      }
    });

    // --- Ignore (permanent) button ---
    const ignoreBtn = document.createElement('button');
    ignoreBtn.textContent = 'Ignorera';
    ignoreBtn.className = 'fb-ignore-btn';
    Object.assign(ignoreBtn.style, {
      marginRight: '1px',
      background: '#cccccc6e',
      color: '#515151',
      border: 'none',
      padding: '3px 6px',
      cursor: 'pointer',
      borderRadius: '3px',
      fontSize: '12px',
    });
    ignoreBtn.addEventListener('click', () => {
      const usernameEl = post.querySelector('.post-user-username');
      if (!usernameEl) return;
      const username = usernameEl.textContent.trim();
      if (!username) return;

      let ignored = getIgnoredUsers();
      if (!ignored.includes(username)) {
        ignored.push(username);
        saveIgnoredUsers(ignored);
      }
      applyIgnoredUsers();
      applyIgnoredUsersToThreads();
    });

    // --- Light-ignore (per-thread) button ---
    const lightBtn = document.createElement('button');
    lightBtn.textContent = 'Ignorera i tråden';
    lightBtn.className = 'fb-lightignore-btn';
    Object.assign(lightBtn.style, {
      marginRight: '1px',
      background: '#cccccc6e',
      color: '#515151',
      border: 'none',
      padding: '3px 6px',
      cursor: 'pointer',
      borderRadius: '3px',
      fontSize: '12px',
    });
    lightBtn.addEventListener('click', () => {
      const usernameEl = post.querySelector('.post-user-username');
      if (!usernameEl) return;
      const username = usernameEl.textContent.trim();
      if (!username) return;
      const threadKey = getThreadKeyFromUrl();
      if (!threadKey) {
        alert("Light-ignora fungerar endast på tråd-/s-/p-sidor.");
        return;
      }
      addLightIgnore(threadKey, username);
      applyLightIgnoredToCurrentThread();
    });

    // Insert buttons in order: Gilla, Dölj, Ignore, Light-ignore
    reportLink.parentNode.insertBefore(interestBtn, reportLink);
    reportLink.parentNode.insertBefore(hideBtn, reportLink);
	    reportLink.parentNode.insertBefore(lightBtn, reportLink);
    reportLink.parentNode.insertBefore(ignoreBtn, reportLink);


    // Citera+ and Citera links stay after Rapportera
    const citeraPlusLink = Array.from(post.querySelectorAll('a')).find(a => a.textContent.trim() === "Citera+");
    const citeraLink = Array.from(post.querySelectorAll('a')).find(a => a.textContent.trim() === "Citera");
    if (citeraPlusLink) reportLink.parentNode.insertBefore(citeraPlusLink, reportLink.nextSibling);
    if (citeraLink) {
      if (citeraPlusLink) reportLink.parentNode.insertBefore(citeraLink, citeraPlusLink.nextSibling);
      else reportLink.parentNode.insertBefore(citeraLink, reportLink.nextSibling);
    }
  });
}

// --- THREADS FUNCTIONS ---
function hideThread(id) {
  const row = document.getElementById("td_title_" + id)?.closest("tr");
  if (row) row.style.display = 'none';
}

function addButtonsToThreads(hiddenIds, markedIds) {
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
    hideBtn.addEventListener("click", () => {
      hideThread(id);
      storage.local.get([storageKeyHidden], (data) => {
        const arr = data[storageKeyHidden] || [];
        if (!arr.includes(id)) {
          arr.push(id);
          storage.local.set({ [storageKeyHidden]: arr });
        }
      });
    });

    const markBtn = document.createElement("button");
    markBtn.textContent = markedIds.includes(id) ? "Ogilla" : "Gilla";
    markBtn.className = "mark-thread-btn";
    Object.assign(markBtn.style, {
      position: "absolute",
      right: "85px",
      top: "50%",
      transform: "translateY(-50%)",
      fontSize: "10px",
      padding: "2px 5px",
      cursor: "pointer",
      background: markedIds.includes(id) ? "orange" : "#c1ffd6",
      color: "#000",
      border: "none",
      borderRadius: "3px",
    });
    markBtn.addEventListener("click", () => {
      storage.local.get([storageKeyMarked], (data) => {
        let arr = data[storageKeyMarked] || [];
        if (arr.includes(id)) {
          arr = arr.filter(x => x !== id);
          row.style.backgroundColor = "";
          markBtn.textContent = "Gilla";
          markBtn.style.background = "#c1ffd6";
        } else {
          arr.push(id);
          row.style.backgroundColor = "#c1ffd6";
          markBtn.textContent = "Ogilla";
          markBtn.style.background = "orange";
        }
        storage.local.set({ [storageKeyMarked]: arr });
      });
    });

    tdTitle.style.position = "relative";
    tdTitle.appendChild(markBtn);
    tdTitle.appendChild(hideBtn);

    if (markedIds.includes(id)) row.style.backgroundColor = "#9cf5ba";
  });
}

// --- APPLYERS & OBSERVERS ---
const url = location.href;

if (url.match(/\/(t|s|p)/)) {
  addButtonsToPosts();
  applyIgnoredUsers();
  applyLightIgnoredToCurrentThread();

  const observer = new MutationObserver(() => {
    addButtonsToPosts();
    applyIgnoredUsers();
    applyLightIgnoredToCurrentThread();
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
else if (url.match(/\/f/)) {
  storage.local.get([storageKeyHidden, storageKeyMarked], (result) => {
    const hiddenIds = result[storageKeyHidden] || [];
    const markedIds = result[storageKeyMarked] || [];
    hiddenIds.forEach(id => hideThread(id));
    addButtonsToThreads(hiddenIds, markedIds);
  });
  applyIgnoredUsersToThreads();
  const observer = new MutationObserver(() => {
    applyIgnoredUsersToThreads();
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

// --- MESSAGING FOR POPUP ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "EXPORT_POSTS") {
    sendResponse({
      postsHidden: getHiddenPosts(),
      postsInteresting: getInterestingPosts(),
      usersIgnored: getIgnoredUsers(),
      lightIgnored: getLightIgnored()
    });
    return true;
  }
  if (message.type === "IMPORT_POSTS") {
    if (Array.isArray(message.postsHidden)) saveHiddenPosts(message.postsHidden);
    if (Array.isArray(message.postsInteresting)) saveInterestingPosts(message.postsInteresting);
    if (Array.isArray(message.usersIgnored)) saveIgnoredUsers(message.usersIgnored);
    if (typeof message.lightIgnored === 'object') saveLightIgnored(message.lightIgnored);
    sendResponse({ success: true });
    return true;
  }
  if (message.type === "REMOVE_LIGHT_IGNORE") {
    // payload: { threadKey, username }
    const { threadKey, username } = message;
    if (threadKey && username) {
      removeLightIgnore(threadKey, username);
      applyLightIgnoredToCurrentThread();
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false });
    }
    return true;
  }
});
