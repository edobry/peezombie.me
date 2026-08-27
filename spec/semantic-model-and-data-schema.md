# Semantic Model & Data Schema

This document defines the conceptual foundations of the website's data structure and its tag-oriented architecture. It prioritizes motivation and capability over implementation details and serves as the core framework for organizing, retrieving, and presenting data across the system.

## Tag-Oriented Information Architecture

- The site uses a nested tag system as its primary organizational substrate.
- Tags can be hierarchical and composable, allowing for complex semantic relationships and context-aware rendering.
- Tags apply across all domains (e.g., GitHub repos, Raindrop links, Spotify playlists, Roam pages, tweets).

## Tag-Driven Behavior

- Tags influence how data is presented.
  - E.g., selected tags determine which fields appear in the content entry form.
- Tags enable:
  - Filtering content by theme, type, or concept.
  - Cross-domain grouping and aggregation.
  - UI adaptations based on semantic context.

## Cross-Domain Interoperability

- Tags unify content from diverse sources under common conceptual structures.
- They allow for connections between disparate data types without needing to normalize them into a single schema.
- E.g., a tag like `#agency` can apply to a tweet, a GitHub repo, a reading list item, or a blog post.

## Interaction with the Exocortex

- The tag system serves as an interface to an externalized memory structure.
- It allows you (and the system) to recall, organize, and recombine thoughts or artifacts in meaningful ways.
- Content retrieval is conceptually grounded, not mechanically categorized — aligning with how ideas and interests are structured internally.
