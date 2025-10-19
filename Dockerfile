FROM node:20-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

# install python & dependencies
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-dev \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# install pnpm
RUN npm install -g pnpm

# working directory & copy files
WORKDIR /app
COPY . /app

# install project dependencies
RUN pnpm install 

CMD ["tail", "-f", "/dev/null"]
