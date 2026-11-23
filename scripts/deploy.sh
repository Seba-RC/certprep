#!/usr/bin/env bash
# Build the question bank, deploy the AWS stack, and publish the website.
#
# Usage:
#   ./scripts/deploy.sh                         # first run asks a few questions (sam deploy --guided)
#   ./scripts/deploy.sh --site-only             # just rebuild questions + upload site (no stack changes)
#
# Needs: AWS CLI v2, AWS SAM CLI, Python 3, and credentials for your AWS account.
# AWS CloudShell has all of these preinstalled.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
STACK="${STACK_NAME:-certprep}"
SITE_ONLY=false
[[ "${1:-}" == "--site-only" ]] && SITE_ONLY=true

echo "==> Building question bank"
python3 scripts/build_bank.py

if ! $SITE_ONLY; then
  # A stack whose first creation failed is stuck in ROLLBACK_COMPLETE and can't be updated.
  STATUS="$(aws cloudformation describe-stacks --stack-name "$STACK" --query 'Stacks[0].StackStatus' --output text 2>/dev/null || true)"
  if [[ "$STATUS" == "ROLLBACK_COMPLETE" ]]; then
    echo "==> Stack '$STACK' failed on its first creation. Here's why:"
    aws cloudformation describe-stack-events --stack-name "$STACK" \
      --query "StackEvents[?ResourceStatus=='CREATE_FAILED'].[LogicalResourceId,ResourceStatusReason]" --output table || true
    echo "==> Deleting the failed stack so it can be created again"
    aws cloudformation delete-stack --stack-name "$STACK"
    aws cloudformation wait stack-delete-complete --stack-name "$STACK"
  fi

  # Sync needs a Cognito domain prefix; an empty one saved in samconfig.toml breaks every deploy.
  if [[ -f samconfig.toml ]] && python3 - samconfig.toml <<'PY'
import re, shlex, sys
text = open(sys.argv[1]).read()
m = re.search(r'parameter_overrides\s*=\s*"((?:[^"\\]|\\.)*)"', text)
params = {}
if m:
    for tok in shlex.split(m.group(1).replace('\\"', '"')):
        k, _, v = tok.partition('=')
        params[k] = v
sys.exit(0 if params.get('EnableSync', 'true') == 'true' and not params.get('AuthDomainPrefix') else 1)
PY
  then
    echo "    samconfig.toml has an empty AuthDomainPrefix, which sign-in and sync need."
    read -r -p "    Enter a unique prefix (e.g. certprep-yourname-2026), or leave blank to turn sync off: " PREFIX
    if [[ -n "$PREFIX" ]]; then
      sam deploy --stack-name "$STACK" --parameter-overrides EnableSync=true "AuthDomainPrefix=$PREFIX" PriceClass=PriceClass_100
    else
      sam deploy --stack-name "$STACK" --parameter-overrides EnableSync=false PriceClass=PriceClass_100
    fi
    echo "    Tip: update parameter_overrides in samconfig.toml so you're not asked again."
  elif [[ -f samconfig.toml ]]; then
    sam deploy --stack-name "$STACK"
  else
    echo "    First deployment: answer the prompts. Choose a unique AuthDomainPrefix (e.g. certprep-yourname-2026),"
    echo "    or set EnableSync=false for a static-only site. Say 'y' to saving arguments to samconfig.toml."
    sam deploy --guided --stack-name "$STACK" --capabilities CAPABILITY_IAM
  fi
fi

out() {
  aws cloudformation describe-stacks --stack-name "$STACK" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue | [0]" --output text 2>/dev/null | sed 's/^None$//'
}
BUCKET="$(out SiteBucketName)"
DIST="$(out DistributionId)"
SITE="$(out SiteUrl)"
API="$(out ApiUrl)"
DOMAIN="$(out CognitoDomain)"
CLIENT="$(out UserPoolClientId)"
REGION="$(aws configure get region || true)"
REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-$REGION}}"

if [[ -z "$BUCKET" || -z "$DIST" ]]; then
  echo "Couldn't read stack outputs for '$STACK'. Deploy the stack first (run without --site-only)." >&2
  exit 1
fi

echo "==> Preparing site"
DIST_DIR="$(mktemp -d)"
trap 'rm -rf "$DIST_DIR"' EXIT
cp -R web/. "$DIST_DIR/"
python3 - "$DIST_DIR/config.json" "$API" "$DOMAIN" "$CLIENT" "$REGION" <<'PY'
import json, sys
path, api, domain, client, region = sys.argv[1:]
json.dump({"apiUrl": api, "cognito": {"domain": domain, "clientId": client, "region": region}},
          open(path, "w"), indent=2)
PY

echo "==> Uploading to s3://$BUCKET"
# HTML, JSON and code are revalidated quickly so new questions and fixes show up right after a deploy.
aws s3 sync "$DIST_DIR/" "s3://$BUCKET/" --delete --only-show-errors \
  --cache-control "public, max-age=300" --exclude ".*"
aws s3 cp "$DIST_DIR/config.json" "s3://$BUCKET/config.json" --only-show-errors \
  --cache-control "no-store" --content-type "application/json"

echo "==> Invalidating CloudFront cache"
aws cloudfront create-invalidation --distribution-id "$DIST" --paths "/*" --query "Invalidation.Id" --output text >/dev/null

echo
echo "Done. Your site: $SITE"
[[ -n "$API" ]] && echo "Sync API:  $API"
echo "(A fresh CloudFront distribution can take a few minutes to start serving.)"
