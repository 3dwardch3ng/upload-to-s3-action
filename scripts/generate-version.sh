#!/usr/bin/env bash
PATH=~/.local/bin:$PATH

BRANCH_NAME=$1

set -e

mkdir ~/.ssh/
echo -e "Host github.com\n\tStrictHostKeyChecking no\n" > ~/.ssh/config

echo "Running semantic versioning"
if ! npx semantic-release --debug; then
  exit 1;
fi

appVersion=$(cat ./package.json | jq -r '.version')
echo $appVersion
if [[ "$BRANCH_NAME" == "release" ]] || [[ "$BRANCH_NAME" == "develop" ]]
then
  if  [ "$appVersion" = "0.0.0" ];
  then
    echo "Error: The current version generated is 0.0.0, we will stop here. Please investigate."
    exit 1;
  fi
fi
