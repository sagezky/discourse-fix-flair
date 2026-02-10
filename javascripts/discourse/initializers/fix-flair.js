import { apiInitializer } from "discourse/lib/api";
import { h } from "virtual-dom";

export default apiInitializer("1.0.0", (api) => {
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

  function createFlairElement(attrs) {
    const flairUrl = attrs.flair_url;
    if (!flairUrl) return null;

    const groupId = attrs.flair_group_id;
    const flairName = attrs.flair_name || "";
    const isIcon = /^fa[srlbd]?-/.test(flairUrl);

    // Inject styles
    injectFlairStyles(groupId, flairUrl, attrs.flair_bg_color, attrs.flair_color);

    const className = `user-flair-inline flair-group-${groupId || "default"}`;

    if (isIcon) {
      const iconName = flairUrl.replace(/^fa[srlbd]?-/, "");
      return h("span.d-icon.d-icon-" + iconName + "." + className, {
        attributes: { title: flairName }
      });
    }

    // For image flair, create a span with the background image
    return h("span." + className, {
      attributes: { title: flairName }
    });
  }

  // Decorate poster-avatar widget to add flair next to avatar
  api.decorateWidget("poster-avatar:after", (helper) => {
    const attrs = helper.attrs;
    return createFlairElement(attrs);
  });

  // Decorate avatar-flair widget (used in user cards, topic lists, etc.)
  api.decorateWidget("avatar-flair:after", (helper) => {
    const attrs = helper.attrs;
    const user = attrs.user || helper.getModel();
    
    if (user) {
      return createFlairElement({
        flair_url: user.flair_url,
        flair_bg_color: user.flair_bg_color,
        flair_color: user.flair_color,
        flair_group_id: user.flair_group_id,
        flair_name: user.flair_name
      });
    }
    return null;
  });

  // Decorate post-avatar widget for topic lists
  api.decorateWidget("post-avatar:after", (helper) => {
    const attrs = helper.attrs;
    return createFlairElement(attrs);
  });

  // Keep the original addPosterIcons for compatibility with poster icons area
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
});
