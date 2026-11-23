#!/usr/bin/env bash
# One-time setup: let GitHub Actions in Seba-RC/certprep deploy to this AWS account.
# Run in AWS CloudShell (same region as the app stack), from the certprep folder:
#   ./scripts/setup_github_deploy.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
APP_STACK="${STACK_NAME:-certprep}"
OWNER="${GITHUB_OWNER:-Seba-RC}"
REPO="${GITHUB_REPO:-certprep}"

# GitHub can sign OIDC tokens with a subject that includes numeric IDs
# (repo:OWNER@OWNER_ID/REPO@REPO_ID:...). Look them up so the trust policy accepts that form too.
if [[ -z "${GITHUB_OWNER_ID:-}" || -z "${GITHUB_REPO_ID:-}" ]]; then
  IDS="$(curl -fsSL "https://api.github.com/repos/$OWNER/$REPO" \
    | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["owner"]["id"], d["id"])' 2>/dev/null || true)"
  read -r GITHUB_OWNER_ID GITHUB_REPO_ID <<< "${IDS:-}" || true
fi
if [[ -n "${GITHUB_OWNER_ID:-}" && -n "${GITHUB_REPO_ID:-}" ]]; then
  echo "==> GitHub IDs: owner $GITHUB_OWNER_ID, repo $GITHUB_REPO_ID"
else
  echo "==> Couldn't look up the GitHub IDs; only the name-based OIDC subject will be accepted." >&2
  echo "    Set GITHUB_OWNER_ID and GITHUB_REPO_ID and run again if deploys fail with AssumeRoleWithWebIdentity." >&2
fi

# An account can only have one GitHub OIDC provider; reuse it if it's already there.
# On a re-run, keep the stack's previous choice: if this stack created the provider,
# passing "false" now would make CloudFormation delete it.
PREV="$(aws cloudformation describe-stacks --stack-name "${APP_STACK}-github-deploy" \
  --query "Stacks[0].Parameters[?ParameterKey=='CreateOidcProvider'].ParameterValue | [0]" \
  --output text 2>/dev/null || true)"
if [[ "$PREV" == "true" || "$PREV" == "false" ]]; then
  CREATE="$PREV"
  echo "==> Stack already exists; keeping CreateOidcProvider=$CREATE."
elif aws iam list-open-id-connect-providers --output text --query 'OpenIDConnectProviderList[].Arn' \
    | tr '\t' '\n' | grep -q 'token.actions.githubusercontent.com$'; then
  CREATE=false
  echo "==> GitHub OIDC provider already exists in this account; reusing it."
else
  CREATE=true
  echo "==> Creating the GitHub OIDC provider."
fi

echo "==> Deploying stack '${APP_STACK}-github-deploy'"
aws cloudformation deploy \
  --stack-name "${APP_STACK}-github-deploy" \
  --template-file infra/github-deploy.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --no-fail-on-empty-changeset \
  --parameter-overrides "GitHubOwner=$OWNER" "GitHubRepo=$REPO" "AppStackName=$APP_STACK" "CreateOidcProvider=$CREATE" \
    "GitHubOwnerId=${GITHUB_OWNER_ID:-}" "GitHubRepoId=${GITHUB_REPO_ID:-}"

ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
echo
echo "Done. Last step, in GitHub:"
echo "  github.com/$OWNER/$REPO > Settings > Secrets and variables > Actions > Variables tab"
echo "  > New repository variable:  Name: AWS_ACCOUNT_ID   Value: $ACCOUNT"
echo
echo "After that, every push to main deploys automatically."
