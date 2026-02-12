#!/usr/bin/env bash
cd "$(dirname "$0")"
exec bun --watch run server.ts
