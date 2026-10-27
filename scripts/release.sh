#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
version="${1:?Usage: scripts/release.sh <version>}"
[[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]
actual="$(python3 -c 'import tomllib; d=tomllib.load(open("Cargo.toml","rb")); print(d["package"]["version"])')"
[[ "$actual" == "$version" ]] || {
  echo "Cargo version $actual differs from release $version" >&2
  exit 1
}
node --input-type=module -e 'import fs from "node:fs"; if(JSON.parse(fs.readFileSync("package.json")).version !== process.argv[1]) process.exit(1)' "$version"
cargo build --locked --release --workspace
stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT
mkdir -p "$stage/bin" dist
install -m755 target/release/elfofera-api "$stage/bin/"
"$stage/bin/elfofera-api" --version | grep -Fx "elfofera-api $version"
target/release/elfofera-api build --source data/calendar/confirmed --output dist
target/release/elfofera-api contract --output dist
pnpm frontend:build
mkdir -p "$stage/share/elfofera-api/contract"
cp dist/archive.json "$stage/share/elfofera-api/"
cp dist/tools.json dist/openapi.json dist/members.json "$stage/share/elfofera-api/contract/"
cp -r frontend/dist "$stage/share/elfofera-api/frontend"
printf '%s\n' "$version" >"$stage/VERSION"
archive="elfofera-api-$version-x86_64-linux.tar.gz"
tar -C "$stage" -czf "dist/$archive" .
(cd dist && sha256sum "$archive" >"$archive.sha256")
