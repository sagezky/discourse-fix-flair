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
      }

      if (css) {
        const el = document.createElement("style");
        el.textContent = css;
        document.head.appendChild(el);
      }
      injectedGroupStyles.add(groupId);
    }
  }

  // Use addPosterIcons - this is still supported and works in posts
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

  // Use decorateUsername to add flair next to usernames everywhere
  api.decorateUsername((username, user) => {
    if (!user || !user.flair_url) return;

    const flairUrl = user.flair_url;
    const groupId = user.flair_group_id;
    const flairName = user.flair_name || "";
    const isIcon = /^fa[srlbd]?-/.test(flairUrl);

    injectFlairStyles(groupId, flairUrl, user.flair_bg_color, user.flair_color);

    const className = `user-flair-inline flair-group-${groupId || "default"}`;

    if (isIcon) {
      const iconName = flairUrl.replace(/^fa[srlbd]?-/, "");
      return `<span class="d-icon d-icon-${iconName} ${className}" title="${flairName}"></span>`;
    }

    return `<span class="${className}" title="${flairName}"></span>`;
  });
});
