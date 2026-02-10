import { apiInitializer } from "discourse/lib/api";

export default apiInitializer("1.8.0", (api) => {
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
        const el = document.createElement("style");
        el.textContent = css;
        document.head.appendChild(el);
      }
      injectedGroupStyles.add(groupId);
    }
  }

  // Use addPosterIcons - this works in posts and is still supported
  api.addPosterIcons((cfs, attrs) => {
    const flairUrl = attrs.flair_url;
    if (!flairUrl) return [];

    const groupId = attrs.flair_group_id;
    const flairName = attrs.flair_name || "";
    const isIcon = /^fa[srlbd]?-/.test(flairUrl);

    injectFlairStyles(groupId, flairUrl, attrs.flair_bg_color, attrs.flair_color);

    const className = `user-flair-inline flair-group-${groupId || "default"}`;

    if (isIcon) {
      const iconName = flairUrl.replace(/^fa[srlbd]?-/, "");
      return [{ icon: iconName, className, title: flairName }];
    }

    return [{ text: "\u200B", className, title: flairName }];
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
});
