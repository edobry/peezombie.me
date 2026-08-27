# Functional Specification

This document outlines the functional capabilities of the site — for both public visitors and you as a signed-in user — based on the intended behaviors, user journeys, and interface mechanisms.

## Authentication & Permissions

- Supports sign-in via multiple identity providers:
  - Social auth
  - Passkeys
  - Crypto wallets
  - URL token
  - OpenID
- Auth is used to gate access to certain pages or data (e.g., admin views, drafts, private notes).

## Tag-Aware Data Entry

- Signed-in users can add new data entries.
- Entry forms adapt dynamically based on selected tags.
  - E.g., a tag like `#project` may reveal fields for a description, demo link, and GitHub URL.
- Forms are designed to integrate seamlessly with the semantic model.

## Dynamic Filtering & Views

- Users can filter data by one or more tags.
- These filtered views can be:
  - Shared via URL
  - Named and saved
  - Persisted to a visible list on the site
- Filtering supports exploration, discovery, and personalized dashboards.

## Content Ingestion & Presentation

- The site ingests content from:
  - GitHub (repos, stars)
  - Goodreads
  - Spotify
  - Raindrop
  - Twitter
  - Roam
  - Instagram
  - Photoprism
  - Substack
- Each type of data is presented using a domain-appropriate UI but is unified by shared tags.

## Messaging & Commenting

- Visitors can leave messages or comments.
- Available to both logged-in and anonymous users.
- Messaging system may use the tag system for categorization or routing.
