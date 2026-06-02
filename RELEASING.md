# Releasing Tidetime

This document defines the versioning and release process for Tidetime.

## Versioning strategy

Tidetime follows **Semantic Versioning** with Git tags in the form `vX.Y.Z`.

### Until `1.0.0`

While the project is in the `0.x` phase:

- `0.Y.0` may include new features and breaking changes
- `0.Y.Z` is used for fixes, docs, polish, and low-risk maintenance work

### After `1.0.0`

Once Tidetime reaches `1.0.0`:

- **MAJOR** for breaking public API or operational changes
- **MINOR** for backwards-compatible features
- **PATCH** for backwards-compatible fixes

## Tagging format

Always use annotated Git tags:

```bash
git tag -a v0.1.0 -m "Tidetime v0.1.0"
```

Push the tag with:

```bash
git push origin v0.1.0
```

## Release checklist

1. Ensure `main` is in a releasable state
2. Run the full quality suite:

   ```bash
   npm run check
   ```

3. Verify required docs are updated:
   - `CHANGELOG.md`
   - `README.md`
   - any changed files in `docs/`
4. If the release version changes, update `package.json` (and lockfile if needed)
5. Add or update a release note in `docs/releases/`
6. Create and push an annotated Git tag
7. Create the GitHub release from that tag

## GitHub releases

When publishing a GitHub release:

- title it with the tag, e.g. `v0.1.0`
- use the polished note from `docs/releases/`
- attach migration or deployment guidance if the release changes operations

## First public release

The first public open-source release for this repository is:

- [`v0.1.0`](./docs/releases/v0.1.0.md)

This version communicates that the project is usable and production-oriented, while still leaving room for iteration before a `1.0.0` stability promise.
