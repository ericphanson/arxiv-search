#!/bin/bash
set -e;
echo "(0/4) Finding all package.json files and running `yarn install` for each one..."
find . -type f -name "package.json" -not -path "*/node_modules/*" -execdir yarn install \; 
echo "(1/4) Running tsc to compile TypeScript files..."
tsc --lib "es2015"
echo "(2/4) Preparing package and uploading to S3..."
aws cloudformation package --template-file lambdas.yaml --output-template-file serverless-output.yaml --s3-bucket arxiv-search-lambda-code
echo "(3/4) Deploying to AWS CloudFormation..."
aws cloudformation deploy --template-file serverless-output.yaml --stack-name lambda
rm serverless-output.yaml
echo "(4/4) Deployment of all lambdas done."