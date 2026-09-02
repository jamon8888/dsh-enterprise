import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebars: SidebarsConfig = {
  docs: [
    "index",
    "roadmap",
    "faq",
    {
      type: "category",
      label: "concepts",
      collapsed: false,
      items: [
        "concepts/method",
        "concepts/the-loop",
        "concepts/projects-and-governance",
        "concepts/sandboxes",
        "concepts/gateway-and-cost",
        "concepts/registry",
        "concepts/watchtower",
        "concepts/inbox",
        "concepts/knowledge",
      ],
    },
    {
      type: "category",
      label: "self-hosting",
      collapsed: false,
      items: [
        "self-host/quickstart",
        "self-host/local-development",
        "self-host/production",
        "self-host/github-app",
        "self-host/aws",
      ],
    },
    {
      type: "category",
      label: "guides",
      collapsed: false,
      items: ["guides/kickstart", "guides/validate-delivery-loop", "guides/existing-repo"],
    },
    {
      type: "category",
      label: "reference",
      items: [
        "reference/architecture",
        "reference/api",
        "reference/cli",
        "reference/mcp",
        "reference/webhooks",
        "reference/guards",
        "reference/security",
        "reference/hardening",
      ],
    },
  ],
};

export default sidebars;
