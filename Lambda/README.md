# Deploying Lambdas to AWS

Code for lambdas gets deployed by the AWS CLI to an S3 bucket. We use `arxiv-search-lambda-code`.

## Creating the lambda

Create a lambda either in `infrastructure` or `processors`. See examples there.

Then add it to `lambdas.yaml`. The important part is that the YAML should contain a `S3_BUCKET` environment variable:
```yaml
  nameoflambda:
    Type: 'AWS::Serverless::Function'
    Properties:
      Handler: index.handler
      Runtime: nodejs6.10
      Environment:
        Variables:
          S3_BUCKET: arxiv-search-lambda-code
```

## Deploying the lambda

The lambdas are deployed via AWS CloudFormation. The following bash script does that for you (assuming you have the AWS CLI configured):

```
./deploy_lambda.sh
```