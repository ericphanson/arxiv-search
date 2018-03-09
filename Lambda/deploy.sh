#!/bin/bash
CODE_BUCKET=${1-arxiv-search-lambda-code}
set -e;
echo "(0/4) Finding all package.json files and running `yarn install` for each one..."
find . -type f -name "package.json" -not -path "*/node_modules/*" -execdir yarn install \; 
echo "(1/4) Running tsc to compile TypeScript files..."
find . -type f -name "tsconfig.json" -not -path "*/node_modules/*" -execdir tsc \;
echo "(2/4) Preparing package and uploading to S3 bucket $CODE_BUCKET..."
aws cloudformation package --template-file template.cf.json --output-template-file output.yaml --s3-bucket $CODE_BUCKET
echo "(3/4) Deploying to AWS CloudFormation..."
aws cloudformation deploy --template-file output.yaml --stack-name arxiv-search-stack --capabilities CAPABILITY_IAM
rm output.yaml
echo "(4/4) Deployment done."