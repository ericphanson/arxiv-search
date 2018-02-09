# arxiv-search

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