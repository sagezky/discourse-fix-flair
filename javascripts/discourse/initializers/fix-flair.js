import { apiInitializer } from "discourse/lib/api";

export default apiInitializer("1.8.0", (api) => {
  console.log("[fix-flair] Plugin loaded!");

  const flairCache = {};
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

  async function getUserFlair(username) {
    if (username in flairCache) return flairCache[username];

    // Mark as loading to prevent duplicate requests
    flairCache[username] = null;

    try {
      // Try to get user from Discourse store first
      const store = api._lookupContainer("service:store");
      if (store) {
        try {
          const user = store.peekRecord("user", username);
          if (user && user.flair_url) {
            console.log(`[fix-flair] Got flair from store for ${username}:`, user.flair_url);
            flairCache[username] = {
              flair_url: user.flair_url,
              flair_bg_color: user.flair_bg_color,
              flair_color: user.flair_color,
              flair_group_id: user.flair_group_id,
              flair_name: user.flair_name,
            };
            return flairCache[username];
          }
        } catch (e) {
          console.log(`[fix-flair] Store peek failed for ${username}:`, e);
        }
      }

      // Try fetching from API endpoints
      const endpoints = [
        `/users/${username}.json`,
        `/u/${username}.json`,
      ];

      for (const endpoint of endpoints) {
        try {
          console.log(`[fix-flair] Trying endpoint: ${endpoint}`);
          const response = await fetch(endpoint);

          if (!response.ok) {
            console.log(`[fix-flair] ${endpoint} returned ${response.status}`);
            continue;
          }

          const data = await response.json();
          const user = data.user || data;

          if (user && user.flair_url) {
            flairCache[username] = {
              flair_url: user.flair_url,
              flair_bg_color: user.flair_bg_color,
              flair_color: user.flair_color,
              flair_group_id: user.flair_group_id,
              flair_name: user.flair_name,
            };
            console.log(`[fix-flair] Got flair for ${username} from ${endpoint}:`, flairCache[username]);
            return flairCache[username];
          }
        } catch (e) {
          console.log(`[fix-flair] Error with ${endpoint} for ${username}:`, e.message);
        }
      }

      console.log(`[fix-flair] No flair found for ${username}`);
    } catch (e) {
      console.log(`[fix-flair] Error fetching flair for ${username}:`, e);
    }

    return flairCache[username];
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
    console.log(`[fix-flair] Found ${usernames.size} unique users to check:`, [...usernames]);

    // Fetch flair data for all unique users (with concurrency limit)
    const promises = [...usernames].map((username) => getUserFlair(username));
    await Promise.all(promises);

    // Now inject flair elements
    userElements.forEach((el) => {
      if (processedElements.has(el)) return;
      processedElements.add(el);

      const username = el.dataset.userCard;
      const flair = flairCache[username];
      if (!flair) return;

      const flairEl = createFlairDOM(flair);

      // Check context and inject appropriately
      const avatar = el.querySelector("img.avatar");
      if (avatar) {
        // This is an avatar link - add flair as overlay directly on the avatar
        const avatarParent = avatar.parentElement;

        // If avatar is direct child of the link, wrap it in a container
        if (avatarParent === el) {
          const wrapper = document.createElement("div");
          wrapper.style.position = "relative";
          wrapper.style.display = "inline-block";
          wrapper.style.lineHeight = "0"; // Prevent extra spacing

          // Replace avatar with wrapper containing avatar
          avatar.parentNode.insertBefore(wrapper, avatar);
          wrapper.appendChild(avatar);

          // Add flair to wrapper
          flairEl.classList.add("fix-flair-avatar-overlay");
          wrapper.appendChild(flairEl);
        } else {
          // Avatar is already in a container, add flair right after avatar image
          avatarParent.style.position = "relative";
          flairEl.classList.add("fix-flair-avatar-overlay");
          // Insert right after the avatar image, not at end of container
          avatar.insertAdjacentElement('afterend', flairEl);
        }
      } else {
        // This is a username text link - add flair after username
        flairEl.classList.add("fix-flair-inline");
        el.after(flairEl);
      }
    });
  }

  // Run on page changes
  api.onPageChange(() => {
    // Run multiple times with delays to catch dynamically loaded content
    setTimeout(injectFlairsOnPage, 300);
    setTimeout(injectFlairsOnPage, 1000);
    setTimeout(injectFlairsOnPage, 2500);
  });

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

  // Also keep addPosterIcons for within-post flair
  api.addPosterIcons((cfs, attrs) => {
    const flairUrl = attrs.flair_url;
    if (!flairUrl) return [];

    const groupId = attrs.flair_group_id;
    const flairName = attrs.flair_name || "";
    const isIcon = /^fa[srlbd]?-/.test(flairUrl);

    injectFlairStyles(groupId, flairUrl, attrs.flair_bg_color, attrs.flair_color);

    const className = `fix-flair fix-flair-${groupId || "default"}`;

    if (isIcon) {
      const iconName = flairUrl.replace(/^fa[srlbd]?-/, "");
      return [{ icon: iconName, className, title: flairName }];
    }

    return [{ text: "\u200B", className, title: flairName }];
  });
});
