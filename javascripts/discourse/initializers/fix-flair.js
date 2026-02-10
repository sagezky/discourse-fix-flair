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

  // Use onPageChange to add flair via DOM manipulation for other locations
  api.onPageChange(() => {
    setTimeout(() => {
      // Find all avatars and add flair next to them
      document.querySelectorAll('[data-user-card]').forEach((element) => {
        if (element.dataset.flairProcessed) return;

        const username = element.dataset.userCard;
        if (!username) return;

        // Mark as processed
        element.dataset.flairProcessed = "true";

        // Try to get user data from the element's attributes
        const flairUrl = element.dataset.flairUrl;
        const flairGroupId = element.dataset.flairGroupId;
        const flairBgColor = element.dataset.flairBgColor;
        const flairColor = element.dataset.flairColor;
        const flairName = element.dataset.flairName || "";

        if (flairUrl && flairGroupId) {
          injectFlairStyles(flairGroupId, flairUrl, flairBgColor, flairColor);

          const isIcon = /^fa[srlbd]?-/.test(flairUrl);
          const className = `user-flair-inline flair-group-${flairGroupId}`;

          let flairElement;
          if (isIcon) {
            const iconName = flairUrl.replace(/^fa[srlbd]?-/, "");
            flairElement = document.createElement("span");
            flairElement.className = `d-icon d-icon-${iconName} ${className}`;
            flairElement.title = flairName;
          } else {
            flairElement = document.createElement("span");
            flairElement.className = className;
            flairElement.title = flairName;
          }

          // Insert flair after the avatar
          element.parentNode?.insertBefore(flairElement, element.nextSibling);
        }
      });
    }, 100);
  });
});
