import { apiInitializer } from "discourse/lib/api";

export default apiInitializer("1.8.0", (api) => {
  console.log("[fix-flair] Plugin loaded!");
  console.log("[fix-flair] API version:", api.version);

  // Log all available API methods for debugging
  console.log("[fix-flair] Available API methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(api)).filter(m => typeof api[m] === 'function').sort());

  const injectedGroupStyles = new Set();

  function injectFlairStyles(groupId, flairUrl, bg, fg) {
    if (groupId && !injectedGroupStyles.has(groupId)) {
      const isIcon = /^fa[srlbd]?-/.test(flairUrl);
      const rules = [];

      if (bg) {
        rules.push(`background-color: #${bg.replace("#", "")}`);
      }
      if (fg) {
        rules.push(`color: #${fg.replace("#", "")}`);
      }

      let css = "";
      if (rules.length) {
        css += `.flair-group-${groupId} { ${rules.join("; ")}; }\n`;
      }

      if (!isIcon) {
        css += `.flair-group-${groupId} { 
          display: inline-block;
          width: 20px; 
          height: 20px; 
          background-image: url("${encodeURI(flairUrl)}"); 
          background-size: contain; 
          background-repeat: no-repeat; 
          background-position: center;
          vertical-align: middle;
          margin-left: 5px;
        }\n`;
      } else {
        css += `.flair-group-${groupId} { 
          display: inline-block;
          margin-left: 5px;
          font-size: 14px;
        }\n`;
      }

      if (css) {
        console.log("[fix-flair] Injecting CSS for group:", groupId, css);
        const el = document.createElement("style");
        el.textContent = css;
        document.head.appendChild(el);
      }
      injectedGroupStyles.add(groupId);
    }
  }

  // Use addPosterIcons - this works in posts and is still supported
  api.addPosterIcons((cfs, attrs) => {
    console.log("[fix-flair] addPosterIcons called!", { cfs, attrs });
    console.log("[fix-flair] attrs keys:", Object.keys(attrs));
    console.log("[fix-flair] flair_url:", attrs.flair_url, "flair_group_id:", attrs.flair_group_id, "flair_name:", attrs.flair_name);

    const flairUrl = attrs.flair_url;
    if (!flairUrl) {
      console.log("[fix-flair] No flair_url, skipping for user:", attrs.username);
      return [];
    }

    const groupId = attrs.flair_group_id;
    const flairName = attrs.flair_name || "";
    const isIcon = /^fa[srlbd]?-/.test(flairUrl);

    console.log("[fix-flair] Adding flair!", { flairUrl, groupId, flairName, isIcon });

    injectFlairStyles(groupId, flairUrl, attrs.flair_bg_color, attrs.flair_color);

    const className = `user-flair-inline flair-group-${groupId || "default"}`;

    if (isIcon) {
      const iconName = flairUrl.replace(/^fa[srlbd]?-/, "");
      return [{ icon: iconName, className, title: flairName }];
    }

    return [{ text: "\u200B", className, title: flairName }];
  });

  // Log DOM state on page change
  api.onPageChange((url) => {
    console.log("[fix-flair] Page changed:", url);

    setTimeout(() => {
      // Check for existing avatar-flair elements
      const existingFlairs = document.querySelectorAll('.avatar-flair');
      console.log("[fix-flair] Existing .avatar-flair elements:", existingFlairs.length);
      existingFlairs.forEach((el, i) => {
        console.log(`[fix-flair] .avatar-flair[${i}]:`, el.outerHTML, "computed display:", getComputedStyle(el).display);
      });

      // Check for poster elements
      const posters = document.querySelectorAll('.topic-post .poster-avatar, .topic-post .names');
      console.log("[fix-flair] Poster elements:", posters.length);

      // Check for poster-icon elements (where addPosterIcons injects)
      const posterIcons = document.querySelectorAll('.poster-icon');
      console.log("[fix-flair] .poster-icon elements:", posterIcons.length);
      posterIcons.forEach((el, i) => {
        console.log(`[fix-flair] .poster-icon[${i}]:`, el.outerHTML);
      });

      // Check for data-user-card elements
      const userCards = document.querySelectorAll('[data-user-card]');
      console.log("[fix-flair] [data-user-card] elements:", userCards.length);

      // Check topic list items
      const topicListItems = document.querySelectorAll('.topic-list-item');
      console.log("[fix-flair] .topic-list-item elements:", topicListItems.length);

      // Check for any flair-related classes
      const flairInline = document.querySelectorAll('.user-flair-inline');
      console.log("[fix-flair] .user-flair-inline elements:", flairInline.length);
      flairInline.forEach((el, i) => {
        console.log(`[fix-flair] .user-flair-inline[${i}]:`, el.outerHTML);
      });
    }, 500);
  });

  // Add CSS to show existing avatar flair everywhere
  const globalFlairCSS = `
    /* Show avatar flair in topic lists */
    .topic-list .posters a[data-user-card] .avatar-flair,
    .topic-list .topic-avatar .avatar-flair {
      display: inline-block !important;
      margin-left: 5px;
    }
    
    /* Show avatar flair in user cards */
    .user-card .avatar-flair,
    .user-info .avatar-flair {
      display: inline-block !important;
      margin-left: 5px;
    }
    
    /* Show avatar flair next to usernames */
    .names .avatar-flair,
    .username .avatar-flair {
      display: inline-block !important;
      margin-left: 5px;
    }
    
    /* Ensure flair is visible */
    .avatar-flair {
      opacity: 1 !important;
      visibility: visible !important;
    }
  `;

  const styleEl = document.createElement("style");
  styleEl.textContent = globalFlairCSS;
  document.head.appendChild(styleEl);
  console.log("[fix-flair] Global flair CSS injected");
});
