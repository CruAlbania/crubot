FROM node:7

# configure brain
ENV LEVELDB_PATH=/data/crubot/leveldb
VOLUME /data/crubot/leveldb

# add files
ADD . /root/crubot
WORKDIR /root/crubot
RUN npm install && node_modules/.bin/gulp build

ENTRYPOINT ["/root/crubot/bin/hubot"]

