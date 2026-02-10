import { apiInitializer } from "discourse/lib/api";

export default apiInitializer("1.0.0", (api) => {
  const injectedGroupStyles = new Set();

  api.addPosterIcons((cfs, attrs) => {
    console.log("fix-flair cfs:", cfs, "attrs:", attrs);

    const flairUrl = attrs.flair_url;
    if (!flairUrl) return [];

    const groupId = attrs.flair_group_id;
    const flairName = attrs.flair_name || "";
    const isIcon = /^fa[srlbd]?-/.test(flairUrl);

    // Inject per-group dynamic styles (colors + image bg) once
    if (groupId && !injectedGroupStyles.has(groupId)) {
      const bg = attrs.flair_bg_color;
      const fg = attrs.flair_color;
      const rules = [];
      if (bg) {
        rules.push(
          `background-color: #${bg.replace("#", "")}`
        );
      }
      if (fg) {
        rules.push(`color: #${fg.replace("#", "")}`);
      }

      let css = "";
      if (rules.length) {
        css += `.flair-group-${groupId} { ${rules.join("; ")}; }\n`;
      }
      if (!isIcon) {
        css += `.flair-group-${groupId}::before { content: ""; display: inline-block; width: 20px; height: 20px; background-image: url("${encodeURI(flairUrl)}"); background-size: contain; background-repeat: no-repeat; vertical-align: middle; }\n`;
      }

      if (css) {
        const el = document.createElement("style");
        el.textContent = css;
        document.head.appendChild(el);
      }
      injectedGroupStyles.add(groupId);
    }

    const className = `user-flair-inline flair-group-${groupId || "default"}`;

    if (isIcon) {
      const iconName = flairUrl.replace(/^fa[srlbd]?-/, "");
      return [{ icon: iconName, className, title: flairName }];
    }

    // Image flair: zero-width space as text, image rendered via ::before CSS
    return [{ text: "\u200B", className, title: flairName }];
  });
});
