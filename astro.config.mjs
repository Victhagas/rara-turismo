import { defineConfig } from "astro/config";

const [owner, repository] = process.env.GITHUB_REPOSITORY?.split("/") ?? [];
const githubPreview = process.env.PUBLIC_GITHUB_PREVIEW === "true";

export default defineConfig(
  githubPreview && owner && repository
    ? {
        site: `https://${owner.toLowerCase()}.github.io`,
        base: `/${repository}`,
        trailingSlash: "always",
      }
    : {},
);
