#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
version="${1:?Usage: scripts/release.sh <version>}"
[[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]
cargo build --locked --release --target x86_64-unknown-linux-gnu --target-dir target
stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT
mkdir -p "$stage/bin" dist
install -m755 target/x86_64-unknown-linux-gnu/release/elfofera-api "$stage/bin/"
"$stage/bin/elfofera-api" --version | grep -Fx "elfofera-api $version"
# Generate the archive and contracts with the exact binary shipped in this package.
content="$stage/share/elfofera-api"
mkdir -p "$content/contract"
"$stage/bin/elfofera-api" build --output "$content"
mv "$content/tools.json" "$content/openapi.json" "$content/members.json" "$content/contract/"
printf '%s\n' "$version" >"$stage/VERSION"
archive="elfofera-api-$version-x86_64-linux.tar.gz"
tar -C "$stage" -czf "dist/$archive" .
(cd dist && sha256sum "$archive" >"$archive.sha256")
