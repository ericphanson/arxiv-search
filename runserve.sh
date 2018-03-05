#!/bin/sh
cd client
yarn install
yarn build
cd ..
exec python3 ./server/servev4.py