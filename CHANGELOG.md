# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed

- reorganized the documentation into clearer guides for users, admins, self-hosters, and contributors
- rewrote the main README and core docs in simpler language
- added a documentation hub, getting started guide, user guide, admin guide, FAQ, and glossary

## [0.1.0] - 2026-06-01

### Added

- production documentation for deployment, architecture, API usage, troubleshooting, and releasing
- health check endpoint at `/api/health`
- Docker production files and open-source community templates
- SEO metadata support via `robots.ts`, `sitemap.ts`, and application icon
- stronger validation helpers for timezones, locations, booking fields, and URLs
- first public release notes for `v0.1.0`

### Changed

- migrated linting to the ESLint CLI with flat config
- hardened environment validation and production startup checks
- improved public slot APIs with safer range and duration validation
- made the integrations page accurately reflect shipped vs planned functionality
- improved metadata and landing page copy to match implemented features
- updated repository metadata and documentation to the canonical GitHub repository

### Fixed

- typecheck reliability when `.next/types` changes between builds
- duplicate event-type slug handling during updates
- dead code and stale placeholder repository metadata
- Docker Postgres volume path persistence configuration
- database/runtime mismatch documentation for unapplied migrations causing missing-column query errors
