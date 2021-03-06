# arxiv-search

This was a project to partially rewrite and extend [arxiv sanity](https://github.com/karpathy/arxiv-sanity-preserver) by [Andrej Karpathy](https://github.com/karpathy) to all of the [arXiv](https://arxiv.org/) and add features such as

* Faceted search
* UI improvements, e.g. infinite scroll
* Elasticsearch as a backend database

We also started rewriting the ingest pipeline to work through Amazon AWS using Lambdas.

Ultimately, we decided to end the project due to time constraints and improvements in the native arxiv interface (see [https://ericphanson.com/blog/2018/arxiv-search/](https://ericphanson.com/blog/2018/arxiv-search/)).

## Build instructions

First time:
```
pip3 install -r requirements.txt
yarn install
```
After that:
```
yarn build
sh ./runserve.sh
```

You can also use `yarn watch` to watch the source files.

## Directories

### `client`

This contains all of the source code to build the static files referenced by the website.

### `static`

This contains the generated static assets of the website. This is generated by calling `yarn build`.

### `server`

The source code to run the server.

### `keys`

You must add a directory `./keys/` containing the following keys:
- `AWS_ACCESS_KEY.txt`
- `AWS_SECRET_KEY.txt`
- `cache_key.txt`
- `log_AWS_ACCESS_KEY.txt`
- `log_AWS_SECRET_KEY.txt`
- `secret_key.txt`
- `ES_USER.txt`
- `ES_LOG_USER.txt`
- `ES_PASS.txt`
- `ES_LOG_PASS.txt`

You must add a directory `./user_db` where the file `as.db` will go to store the user data.
