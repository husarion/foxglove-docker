ARG ROS_DISTRO=humble

# =========================== Foxglove builder ===============================
FROM node:16 as foxglove_build
WORKDIR /src

RUN apt-get update && \
    apt-get install -y git-lfs && \
    git clone -b reverse-proxy https://github.com/husarion/foxglove-docker . && \
    git lfs pull

RUN corepack enable
RUN yarn install --immutable

RUN yarn run web:build:prod

# =========================== Release stage ===============================
FROM caddy:2.6.2-alpine
WORKDIR /src

RUN apk update && apk add \
        bash \
        nss-tools

COPY --from=foxglove_build /src/web/.webpack ./

COPY disable_cache.js /
COPY disable_interaction.js /

COPY Caddyfile /etc/caddy/
COPY Caddyfile_reverse_proxy /etc/caddy/
COPY entrypoint.sh /
COPY run.sh /

EXPOSE 8080

ENV DS_TYPE=foxglove-websocket
ENV DS_PORT=8765
ENV UI_PORT=8080
ENV DISABLE_INTERACTION=false
ENV DISABLE_CACHE=true

# only for IPv6 -> IPv4 reverse proxy for foxglove-websocket datasource (that can listen only on IPv4)
ENV DS_HOST=

ENTRYPOINT ["/bin/bash", "/entrypoint.sh"]
CMD /run.sh
