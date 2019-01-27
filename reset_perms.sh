#!/bin/sh

find . -path ./client/node_modules -prune -o -path ./server/node_modules -prune -o -type f -exec chmod 600 {} \;
find . -path ./client/node_modules -prune -o -path ./server/node_modules -prune -o -type d -exec chmod 700 {} \;
chmod +x $0
