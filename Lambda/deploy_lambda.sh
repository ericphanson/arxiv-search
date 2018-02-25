#!/bin/bash
if [ $# -eq 0 ]; then
    echo "No arguments provided. First argument should be the lambda name."
    exit 1
fi
set -e;
cd $1
if [ -f $1/package.json ]; then
    echo "package.json found, so running yarn install..."
    yarn install
fi
echo "Preparing package and uploading to S3..."
aws cloudformation package --template-file $1.yaml --output-template-file serverless-output.yaml --s3-bucket arxiv-search-lambda-code
echo "Deploying to AWS CloudFormation..."
aws cloudformation deploy --template-file serverless-output.yaml --stack-name lambda-$1
rm serverless-output.yaml
echo "Deployment of $1 done."