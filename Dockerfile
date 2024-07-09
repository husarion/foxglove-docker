ARG ROS_DISTRO=humble

# =========================== Foxglove builder ===============================
FROM node:16 AS foxglove_build
WORKDIR /src

RUN apt-get update && \
    apt-get install -y git-lfs && \
    git clone -b improvements https://github.com/husarion/foxglove-docker . && \
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
COPY entrypoint.sh /

EXPOSE 8080

ENV DISABLE_INTERACTION=false
ENV DISABLE_CACHE=true

ENTRYPOINT ["/bin/bash", "/entrypoint.sh"]
CMD caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
