#!/usr/bin/env bash
#
# Publie @bbg/camino-scoring : compile le cœur et pousse le résultat sur la
# branche `camino-scoring-dist`, avec une étiquette par version.
#
# On ne change pas de branche dans le dossier de travail : l'arbre à publier
# est construit à part, puis écrit directement dans l'historique de la branche
# de distribution avec la plomberie de git. Rien ici ne touche à la branche
# courante ni à vos fichiers.
#
#   npm run release:scoring
#
set -euo pipefail
cd "$(dirname "$0")/.."

PKG=packages/camino-scoring
BRANCHE=camino-scoring-dist
VERSION=$(node -p "require('./$PKG/package.json').version")
ETIQUETTE="camino-scoring-v$VERSION"
DEPART=$(git rev-parse --short HEAD)

if git rev-parse -q --verify "refs/tags/$ETIQUETTE" >/dev/null || git ls-remote --exit-code --tags origin "$ETIQUETTE" >/dev/null 2>&1; then
  echo "L'étiquette $ETIQUETTE existe déjà : montez la version dans $PKG/package.json avant de publier." >&2
  exit 1
fi

echo "── 1/4 tests"
npm test --silent

echo "── 2/4 compilation"
rm -rf "$PKG/dist"
npx tsc -p "$PKG/tsconfig.json"
# TypeScript réécrit les extensions .ts → .js dans le JavaScript émis, mais
# les laisse dans les déclarations : on finit le travail, pour que les .d.ts
# se résolvent partout (bundler comme node16).
find "$PKG/dist" -name '*.d.ts' -exec sed -i -E "s/(from ['\"]\.[^'\"]*)\.ts(['\"])/\1.js\2/g; s/(import\(['\"]\.[^'\"]*)\.ts(['\"]\))/\1.js\2/g" {} +
if grep -rqE "from ['\"]\.[^'\"]*\.ts['\"]" "$PKG/dist"; then
  echo "Il reste des imports en .ts dans $PKG/dist" >&2
  exit 1
fi
test -f "$PKG/dist/engine/index.js" && test -f "$PKG/dist/vision/index.d.ts"

echo "── 3/4 arbre de publication"
ETAPE=$(mktemp -d)
trap 'rm -rf "$ETAPE" "${INDEX:-}"' EXIT
cp -r "$PKG/dist" "$ETAPE/dist"
cp "$PKG/package.json" "$PKG/README.md" "$ETAPE/"
cat > "$ETAPE/.gitattributes" <<'EOF'
* -diff
EOF

# Un index temporaire : on y range l'arbre sans toucher à celui du dépôt.
INDEX=$(mktemp)
rm -f "$INDEX"
export GIT_INDEX_FILE="$INDEX"
git read-tree --empty
git --work-tree="$ETAPE" add -A
ARBRE=$(git write-tree)
unset GIT_INDEX_FILE

git fetch -q origin "refs/heads/$BRANCHE:refs/remotes/origin/$BRANCHE" 2>/dev/null || true
PARENT=$(git rev-parse -q --verify "refs/remotes/origin/$BRANCHE" || true)
MESSAGE="camino-scoring $VERSION — compilé depuis $DEPART"
if [ -n "$PARENT" ]; then
  COMMIT=$(printf '%s\n' "$MESSAGE" | git commit-tree "$ARBRE" -p "$PARENT")
else
  COMMIT=$(printf '%s\n' "$MESSAGE" | git commit-tree "$ARBRE")
fi
git update-ref "refs/heads/$BRANCHE" "$COMMIT"
git tag -a "$ETIQUETTE" -m "$MESSAGE" "$COMMIT"

echo "── 4/4 publication"
git push origin "refs/heads/$BRANCHE:refs/heads/$BRANCHE" "refs/tags/$ETIQUETTE"

echo
echo "Publié : $ETIQUETTE  (commit $(git rev-parse --short "$COMMIT") sur $BRANCHE)"
echo "Installation :  npm install github:valentindrouet-dev/camino#$ETIQUETTE"
