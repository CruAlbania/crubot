FROM node:7

# ensure node-gyp installed
RUN npm install --global node-gyp && \
    node-gyp --version && \
    python --version && \
    g++ --version

# configure brain
ENV LEVELDB_PATH=/data/crubot/leveldb
VOLUME /data/crubot/leveldb

# add files
ADD . /root/crubot
WORKDIR /root/crubot
RUN yarn install && node_modules/.bin/gulp build

ENTRYPOINT ["/root/crubot/bin/hubot"]

