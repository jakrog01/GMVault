# Maintaining releases

This page is for maintainers preparing a release. Owners who need to update a vault should follow [Keeping a vault up to date](UPDATING.md).

## Cut a release

Work happens on feature branches that merge into `dev` through pull requests. A release is a pull request from `dev` into `master`; every merge into `master` is a release.

Before opening that pull request, finish the release changes, rebuild the shipped plugin, and run the repository test suite and `doctor`. Bump `_system/VERSION` and the shipped versions consistently, and add a `## X.Y.Z` section to `CHANGELOG.md`. The `checks` workflow runs `npm test` on every pull request into `dev` or `master`, and for `master` it fails unless `_system/VERSION` is newer than the latest `v*` tag and has its changelog section.

Do not create tags by hand. After the merge, the release workflow runs `npm test`, runs `_system/bin/package-release.mjs`, and creates the GitHub release together with the `vX.Y.Z` tag on the merged commit. The tag is the boundary: do not change the release contents after it exists.

## Keep migrations permanent

Migration IDs are immutable. Never edit or reuse an existing migration: an installed vault records completed IDs and will not run an edited migration again. Put a repair in a new migration. The CLI already installed in a vault performs the initial replacement, and only the newly installed CLI runs pending migrations.

Review a migration against an already-updated vault as well as a fresh one. The update process records completed migration IDs in `.gmvault/state.json`, so reuse would make a changed migration invisible to vaults that already recorded it.

## What a merge into master triggers

A push to `master` runs the release workflow. If `_system/VERSION` is not tagged yet, its `package` job passes `npm test`, publishes the release archive under the new tag, and the documentation site is built for GitHub Pages. If the version is already tagged, nothing is released. Repository settings must enable GitHub Pages with **Source: GitHub Actions** once before the first deployment.

The released archive is the input to both online and offline owner updates. The `releaseInclude` and `releaseExclude` fields in `_system/manifest.json` are the package source of truth. The archive contains `_system/`, `_local/`, Obsidian configuration except workspace files, `.gmvault/plugin-build.json`, the seven content roots and their keep files, `Active.md`, `Home.md`, and `.gitignore`. It excludes repository documentation, tests, workflows, `package.json`, and `.gmvault/state.json`. Keep `_system/VERSION` in the archive so the updater can validate it.
