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

# An account can only have one GitHub OIDC provider; reuse it if it's already there.
if aws iam list-open-id-connect-providers --output text --query 'OpenIDConnectProviderList[].Arn' \
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
  --parameter-overrides "GitHubOwner=$OWNER" "GitHubRepo=$REPO" "AppStackName=$APP_STACK" "CreateOidcProvider=$CREATE"

ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
echo
echo "Done. Last step, in GitHub:"
echo "  github.com/$OWNER/$REPO > Settings > Secrets and variables > Actions > Variables tab"
echo "  > New repository variable:  Name: AWS_ACCOUNT_ID   Value: $ACCOUNT"
echo
echo "After that, every push to main deploys automatically."
