#!/bin/bash
set -e

# install node packages
pnpm install

# keep running container
tail -f /dev/null