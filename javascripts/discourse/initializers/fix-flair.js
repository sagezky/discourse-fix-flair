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

      // Only inject flair on elements that contain an avatar image
      const avatar = el.querySelector("img.avatar");
      // If no avatar, this is likely a username link.
      // We still want to inject flair here as per user request (inline flair)
      if (!avatar) {
        // Just check if *this specific element* already has a flair or if one is right next to it
        if (el.querySelector(".fix-flair") || (el.nextElementSibling && el.nextElementSibling.classList.contains("fix-flair"))) {
          processedElements.add(el);
          continue;
        }

        // Fetch flair for this username link
        const inlineUsername = el.dataset.userCard;
        const inlineFlair = await getUserFlair(inlineUsername);
        if (!inlineFlair) {
          processedElements.add(el);
          continue;
        }

        // Inject inline flair after the username element
        processedElements.add(el);
        const flairEl = createFlairDOM(inlineFlair);
        flairEl.classList.add("fix-flair-inline");
        el.after(flairEl);
        continue;
      }

      const username = el.dataset.userCard;
      const flair = await getUserFlair(username);
      if (!flair) {
        processedElements.add(el);
        continue;
      }

      // Don't inject if a flair already exists here (our own flair)
      if (el.querySelector(".fix-flair")) {
        processedElements.add(el);
        continue;
      }

      // Check for native Discourse flair or other existing flair elements nearby
      // e.g. .avatar-flair, .poster-icon
      const parent = el.closest(".post-avatar, .topic-avatar, .poster-avatar, .user-card-avatar");
      if (parent && parent.querySelector(".avatar-flair")) {
        processedElements.add(el);
        continue;
      }

      processedElements.add(el);
      const flairEl = createFlairDOM(flair);

      // Wrap avatar in its own small container for proper positioning
      const wrapper = document.createElement("span");
      wrapper.className = "fix-flair-wrapper";

      avatar.parentNode.insertBefore(wrapper, avatar);
      wrapper.appendChild(avatar);

      flairEl.classList.add("fix-flair-avatar-overlay");
      wrapper.appendChild(flairEl);

      // Also inject inline flair inside username text span if present
      // e.g. topic list items that contain both avatar and .username span
      const usernameSpan = el.querySelector(".username");
      if (usernameSpan && !usernameSpan.querySelector(".fix-flair-inline")) {
        const inlineFlairEl = createFlairDOM(flair);
        inlineFlairEl.classList.add("fix-flair-inline");
        usernameSpan.appendChild(inlineFlairEl);
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
