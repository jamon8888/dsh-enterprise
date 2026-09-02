import type * as Preset from "@docusaurus/preset-classic";
import type { Config } from "@docusaurus/types";
import { themes } from "prism-react-renderer";

// Where the built site will live. The Pages workflow passes what GitHub itself
// reports (`https://theam.github.io` + `/facility`), so pointing a custom
// domain at the site later needs no edit here. The defaults serve the site at
// the root, which is what a local `pnpm dev` wants.
const url = process.env.DOCS_URL ?? "https://theam.github.io";
const baseUrl = `${(process.env.DOCS_BASE_URL ?? "").replace(/\/+$/, "")}/`;

const config: Config = {
  title: "facility",
  tagline: "The platform that governs your AI SDLC.",
  favicon: "img/favicon.ico",
  url,
  baseUrl,
  organizationName: "theam",
  projectName: "facility",
  onBrokenLinks: "throw",
  markdown: { hooks: { onBrokenMarkdownLinks: "throw" } },
  i18n: { defaultLocale: "en", locales: ["en"] },

  presets: [
    [
      "classic",
      {
        docs: {
          routeBasePath: "/",
          sidebarPath: "./sidebars.ts",
          editUrl: "https://github.com/theam/facility/tree/main/apps/docs/",
        },
        blog: false,
        theme: { customCss: "./src/css/custom.css" },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    colorMode: {
      defaultMode: "dark",
      disableSwitch: true,
      respectPrefersColorScheme: false,
    },
    navbar: {
      title: "facility.",
      items: [
        { type: "docSidebar", sidebarId: "docs", position: "left", label: "docs" },
        { href: "https://github.com/theam/facility", label: "github", position: "right" },
      ],
    },
    footer: {
      style: "dark",
      copyright: `An initiative by <a href="https://theagilemonkeys.com">The Agile Monkeys</a>`,
    },
    prism: {
      theme: themes.vsDark,
      additionalLanguages: ["bash", "json", "yaml", "docker"],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
