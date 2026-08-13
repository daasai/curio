# P0-B controlled word-family update

This directory contains the local-only pre-update CSV and SQLite backup, deterministic dry-run diff, decision hash, and manifest. The SQLite backup can contain local business data; do not distribute it. Roll back by restoring `before/curio_gaokao_vocabulary.csv`, then run `npm run db:seed`; restore `before/curio.db` only when a full local database rollback is required.
