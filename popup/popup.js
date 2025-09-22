// popup.js - updated to show light-ignored users grouped by thread

const storage = browser.storage.local;
const storageKeyHidden = "hiddenFlashbackThreads";
const storageKeyMarked = "markedFlashbackThreads";

// Helper
function getActiveFlashbackTab(callback) {
  browser.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (tab && tab.url && tab.url.includes("flashback.org")) {
      callback(tab);
    } else {
      alert("Öppna flashback.org för att använda den här funktionen.");
    }
  });
}

// --- Ignored Users UI (permanent) ---
function renderIgnoredUsers() {
  getActiveFlashbackTab((tab) => {
    browser.tabs.sendMessage(tab.id, { type: "EXPORT_POSTS" }, (data) => {
      const ignored = data?.usersIgnored || [];
      const listEl = document.getElementById("ignoredList");
      listEl.innerHTML = "";

      if (ignored.length === 0) {
        listEl.textContent = "Inga ignorerade.";
        return;
      }

      ignored.forEach((user) => {
        const row = document.createElement("div");
        row.className = "ignored-user";
        row.textContent = user;

        const btn = document.createElement("button");
        btn.textContent = "X";
        btn.className = "unignore-btn";
        btn.addEventListener("click", () => {
          const newList = ignored.filter(u => u !== user);
          // update content script
          browser.tabs.sendMessage(
            tab.id,
            { type: "IMPORT_POSTS", usersIgnored: newList },
            () => {
              renderIgnoredUsers();
            }
          );
        });

        row.appendChild(btn);
        listEl.appendChild(row);
      });
    });
  });
}

// --- Light-ignored UI (per-thread mapping) ---
function renderLightIgnored() {
  getActiveFlashbackTab((tab) => {
    browser.tabs.sendMessage(tab.id, { type: "EXPORT_POSTS" }, (data) => {
      const mapping = data?.lightIgnored || {};
      const listEl = document.getElementById("lightIgnoredList");
      listEl.innerHTML = "";

      const keys = Object.keys(mapping).sort();
      if (keys.length === 0) {
        listEl.textContent = "Inga light-ignored användare.";
        return;
      }

      keys.forEach(threadKey => {
        const users = mapping[threadKey] || [];
        if (!users.length) return;

        const container = document.createElement("div");
        container.className = "light-thread";

        const header = document.createElement("div");
        header.className = "thread-key";
        // create clickable link to thread (page 1)
        const a = document.createElement("a");
        a.href = `https://www.flashback.org/${threadKey}`;
        a.target = "_blank";
        a.textContent = threadKey;
        header.appendChild(a);
        container.appendChild(header);

        users.forEach(user => {
          const row = document.createElement("div");
          row.className = "ignored-user";
          row.textContent = user;

          const btn = document.createElement("button");
          btn.textContent = "Ta bort";
          btn.className = "unignore-btn";
          btn.addEventListener("click", () => {
            // ask content script to remove this mapping entry
            browser.tabs.sendMessage(tab.id, { type: "REMOVE_LIGHT_IGNORE", threadKey, username: user }, (res) => {
              // re-render after change
              setTimeout(renderLightIgnored, 150);
            });
          });

          row.appendChild(btn);
          container.appendChild(row);
        });

        listEl.appendChild(container);
      });
    });
  });
}

// --- Reset ---
document.getElementById("resetBtn").addEventListener("click", () => {
  if (!confirm("Är du säker på att du vill återställa all data?")) return;

  // clear storage.local thread states and localStorage via content script
  storage.local.remove([storageKeyHidden, storageKeyMarked], () => {
    getActiveFlashbackTab((tab) => {
      browser.tabs.sendMessage(
        tab.id,
        {
          type: "IMPORT_POSTS",
          postsHidden: [],
          postsInteresting: [],
          usersIgnored: [],
          lightIgnored: {}
        },
        () => {
          browser.tabs.reload(tab.id);
          alert("All data har återställts.");
          renderIgnoredUsers();
          renderLightIgnored();
        }
      );
    });
  });
});

// --- Export ---
document.getElementById("exportBtn").addEventListener("click", () => {
  storage.local.get([storageKeyHidden, storageKeyMarked], (result) => {
    const threadsHidden = result[storageKeyHidden] || [];
    const threadsMarked = result[storageKeyMarked] || [];

    getActiveFlashbackTab((tab) => {
      browser.tabs.sendMessage(tab.id, { type: "EXPORT_POSTS" }, (postData) => {
        const data = {
          threadsHidden,
          threadsMarked,
          postsHidden: postData?.postsHidden || [],
          postsInteresting: postData?.postsInteresting || [],
          usersIgnored: postData?.usersIgnored || [],
          lightIgnored: postData?.lightIgnored || {}
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: "application/json"
        });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = "flashback_data.json";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
    });
  });
});

// --- Import ---
document.getElementById("importBtn").addEventListener("click", () => {
  document.getElementById("fileInput").click();
});

document.getElementById("fileInput").addEventListener("change", function () {
  const file = this.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);

      storage.local.set({
        [storageKeyHidden]: data.threadsHidden || [],
        [storageKeyMarked]: data.threadsMarked || []
      });

      getActiveFlashbackTab((tab) => {
        browser.tabs.sendMessage(
          tab.id,
          {
            type: "IMPORT_POSTS",
            postsHidden: data.postsHidden || [],
            postsInteresting: data.postsInteresting || [],
            usersIgnored: data.usersIgnored || [],
            lightIgnored: data.lightIgnored || {}
          },
          () => {
            browser.tabs.reload(tab.id);
            alert("Data importerad!");
            renderIgnoredUsers();
            renderLightIgnored();
          }
        );
      });
    } catch (err) {
      alert("Ogiltig JSON-fil.");
    }
  };
  reader.readAsText(file);
});

// --- On popup open: render lists ---
document.addEventListener("DOMContentLoaded", () => {
  renderIgnoredUsers();
  renderLightIgnored();
});
