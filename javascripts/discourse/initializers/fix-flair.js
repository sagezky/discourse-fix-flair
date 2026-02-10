import { apiInitializer } from "discourse/lib/api";

export default apiInitializer("1.0.0", (api) => {
  api.decorateWidget("poster-name:after", (helper) => {
    const attrs = helper.attrs;

    // Debug: inspect available flair data
    console.log("fix-flair poster-name attrs:", attrs);

    if (!attrs.flair_url) {
      return null;
    }

    const style = buildFlairStyle(attrs.flair_bg_color, attrs.flair_color);
    return renderFlair(helper, attrs.flair_url, attrs.flair_name, style);
  });

  api.decorateWidget("topic-list-item:after", (helper) => {
    const attrs = helper.attrs;

    console.log("fix-flair topic-list-item attrs:", attrs);

    const lastPoster = attrs.lastPoster || attrs.last_poster;
    if (lastPoster) {
      console.log("fix-flair lastPoster:", lastPoster);
    }
  });

  function buildFlairStyle(bgColor, fgColor) {
    const parts = [];
    if (bgColor) {
      const bg = bgColor.startsWith("#") ? bgColor : `#${bgColor}`;
      parts.push(`background-color: ${bg}`);
    }
    if (fgColor) {
      const fg = fgColor.startsWith("#") ? fgColor : `#${fgColor}`;
      parts.push(`color: ${fg}`);
    }
    return parts.join("; ");
  }

  function renderFlair(helper, flairUrl, flairName, style) {
    const isIcon = /^fa[srlbd]?-/.test(flairUrl);
    const title = flairName || "";

    if (isIcon) {
      const faClass = flairUrl.replace(/^(fa[srlbd]?)-/, "$1 fa-");
      return helper.h(
        "i.fa.user-flair-inline",
        { attributes: { style, title }, className: faClass }
      );
    }

    return helper.h("img.user-flair-inline", {
      attributes: {
        src: flairUrl,
        alt: title,
        title,
        style,
        loading: "lazy",
      },
    });
  }
});
