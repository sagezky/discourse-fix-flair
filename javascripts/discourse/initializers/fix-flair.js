import { apiInitializer } from "discourse/lib/api";

export default apiInitializer("1.8.0", (api) => {

  const injectedGroupStyles = new Set();
  const processedElements = new WeakSet();

  function injectFlairStyles(groupId, flairUrl, bg, fg) {
    if (!groupId || injectedGroupStyles.has(groupId)) return;

    const isIcon = /^fa[srlbd]?-/.test(flairUrl);
    let css = "";

    if (bg || fg) {
      const rules = [];
      if (bg) rules.push(`background-color: #${bg.replace("#", "")}`);
      if (fg) rules.push(`color: #${fg.replace("#", "")}`);
      css += `.fix-flair-${groupId} { ${rules.join("; ")}; }\n`;
    }

    if (!isIcon) {
      css += `.fix-flair-${groupId} {
        display: inline-block;
        width: 20px;
        height: 20px;
        background-image: url("${encodeURI(flairUrl)}");
        background-size: contain;
        background-repeat: no-repeat;
        background-position: center;
        border-radius: 4px;
      }\n`;
    }

    if (css) {
      const el = document.createElement("style");
      el.textContent = css;
      document.head.appendChild(el);
    }
    injectedGroupStyles.add(groupId);
  }

  function createFlairDOM(flairData) {
    const { flair_url, flair_bg_color, flair_color, flair_group_id, flair_name } = flairData;
    const isIcon = /^fa[srlbd]?-/.test(flair_url);

    injectFlairStyles(flair_group_id, flair_url, flair_bg_color, flair_color);

    const span = document.createElement("span");
    span.className = `fix-flair fix-flair-${flair_group_id || "default"}`;
    span.title = flair_name || "";

    if (isIcon) {
      const iconName = flair_url.replace(/^fa[srlbd]?-/, "");
      const icon = document.createElement("i");
      icon.className = `fa fa-${iconName}`;
      span.appendChild(icon);
    }

    return span;
  }

  const flairPromises = {};

  async function fetchFlairData(username) {
    try {
      // Try fetching from API endpoints
      const endpoints = [
        `/users/${username}.json`,
        `/u/${username}.json`,
      ];

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint);
          if (!response.ok) continue;

          const data = await response.json();
          const user = data.user || data;

          if (user && user.flair_url) {
            return {
              flair_url: user.flair_url,
              flair_bg_color: user.flair_bg_color,
              flair_color: user.flair_color,
              flair_group_id: user.flair_group_id,
              flair_name: user.flair_name,
            };
          }
        } catch (e) {
          // Fallback to next endpoint
        }
      }
    } catch (e) {
      // Silent error
    }
    return null;
  }

  function getUserFlair(username) {
    // Return existing promise so all callers wait for the same fetch
    if (!flairPromises[username]) {
      flairPromises[username] = fetchFlairData(username);
    }
    return flairPromises[username];
  }

  async function injectFlairsOnPage() {
    // Find all elements with data-user-card attribute (usernames/avatars)
    const userElements = document.querySelectorAll("[data-user-card]");

    // Collect unique usernames first
    const usernames = new Set();
    userElements.forEach((el) => {
      const username = el.dataset.userCard;
      if (username && !processedElements.has(el)) {
        usernames.add(username);
      }
    });

    if (usernames.size === 0) return;


    // Fetch flair data for all unique users (with concurrency limit)
    const promises = [...usernames].map((username) => getUserFlair(username));
    await Promise.all(promises);

    // Now inject flair elements
    for (const el of userElements) {
      if (processedElements.has(el)) continue;

      const username = el.dataset.userCard;
      const flair = await getUserFlair(username);
      if (!flair) {
        processedElements.add(el);
        continue;
      }

      // Prevention: Don't inject if a flair element already exists nearby
      if (el.querySelector(".fix-flair") || (el.nextElementSibling && el.nextElementSibling.classList.contains("fix-flair"))) {
        processedElements.add(el);
        continue;
      }

      const avatar = el.querySelector("img.avatar");

      // If this is a username link (not an avatar), check if there's an avatar flair nearby 
      // in the same parent container to avoid redundancy (like in post headers)
      if (!avatar) {
        const parent = el.closest(".topic-body, .post-header, .user-info, .topic-list-item");
        if (parent && parent.querySelector(".fix-flair-avatar-overlay")) {
          processedElements.add(el);
          continue;
        }
      }

      processedElements.add(el);
      const flairEl = createFlairDOM(flair);

      if (avatar) {
        // Always wrap avatar in its own small container for proper positioning
        const wrapper = document.createElement("span");
        wrapper.className = "fix-flair-wrapper";

        // Replace avatar with wrapper containing avatar + flair
        avatar.parentNode.insertBefore(wrapper, avatar);
        wrapper.appendChild(avatar);

        flairEl.classList.add("fix-flair-avatar-overlay");
        wrapper.appendChild(flairEl);
      } else {
        // This is a username text link - add flair after username
        flairEl.classList.add("fix-flair-inline");
        el.after(flairEl);
      }
    }
  }

  // Run on page changes (subsequent navigation)
  api.onPageChange(() => {
    setTimeout(injectFlairsOnPage, 300);
    setTimeout(injectFlairsOnPage, 1000);
    setTimeout(injectFlairsOnPage, 2500);
  });

  // Run on initial page load
  setTimeout(injectFlairsOnPage, 500);
  setTimeout(injectFlairsOnPage, 1500);
  setTimeout(injectFlairsOnPage, 3000);

  // Also observe DOM changes for dynamically loaded content
  const observer = new MutationObserver(() => {
    // Debounce
    clearTimeout(observer._timeout);
    observer._timeout = setTimeout(injectFlairsOnPage, 200);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
});
