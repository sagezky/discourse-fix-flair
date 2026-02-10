import Component from "@glimmer/component";
import { apiInitializer } from "discourse/lib/api";
import { htmlSafe } from "@ember/template";

class InlineFlair extends Component {
  get source() {
    const oa = this.args.outletArgs;
    console.log("fix-flair poster-name outletArgs:", oa);
    return oa?.model || oa?.post || oa;
  }

  get flairUrl() {
    return this.source?.flair_url || this.source?.user?.flair_url;
  }

  get flairName() {
    return (
      this.source?.flair_name || this.source?.user?.flair_name || ""
    );
  }

  get isIcon() {
    return this.flairUrl && /^fa[srlbd]?-/.test(this.flairUrl);
  }

  get isImage() {
    return this.flairUrl && !this.isIcon;
  }

  get flairStyle() {
    const bgColor =
      this.source?.flair_bg_color || this.source?.user?.flair_bg_color;
    const fgColor =
      this.source?.flair_color || this.source?.user?.flair_color;
    const parts = [];
    if (bgColor) {
      const bg = bgColor.startsWith("#") ? bgColor : `#${bgColor}`;
      parts.push(`background-color: ${bg}`);
    }
    if (fgColor) {
      const fg = fgColor.startsWith("#") ? fgColor : `#${fgColor}`;
      parts.push(`color: ${fg}`);
    }
    return htmlSafe(parts.join("; "));
  }

  get iconClass() {
    if (!this.isIcon) return "";
    return this.flairUrl.replace(/^(fa[srlbd]?)-/, "$1 fa-");
  }

  <template>
    {{#if this.isIcon}}
      <i
        class="fa {{this.iconClass}} user-flair-inline"
        style={{this.flairStyle}}
        title={{this.flairName}}
      ></i>
    {{else if this.isImage}}
      <img
        class="user-flair-inline"
        src={{this.flairUrl}}
        alt={{this.flairName}}
        title={{this.flairName}}
        style={{this.flairStyle}}
        loading="lazy"
      />
    {{/if}}
  </template>
}

export default apiInitializer("1.0.0", (api) => {
  api.renderInOutlet("poster-name:after", InlineFlair);
});
