# CloudFormation code.

Code for the Lambdas gets deployed by the AWS CLI to an S3 bucket.
The default is `arxiv-search-lambda-code` but you can pass another bucket name to put the code in as an optional argument.

## Deploying the stack

The stack is deployed via AWS CloudFormation. The following bash script does that for you (assuming you have the AWS CLI configured):

```sh
# uploads to the S3 bucket 'arxiv-search-lambda-code'
./deploy.sh
# uploads to your favourite bucket
./deploy.sh my-bucket-name
```

## Creating the lambda

__TODO update this to use CloudFormation rather than SAM__

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
