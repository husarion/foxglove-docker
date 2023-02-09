# Build stage
FROM node:16 as build

RUN apt update && apt install -y \
        git-lfs

WORKDIR /src
RUN git clone https://github.com/foxglove/studio
WORKDIR /src/studio

COPY defaultLayout.ts ./packages/studio-base/src/providers/CurrentLayoutProvider/defaultLayout.ts
COPY Start.tsx ./packages/studio-base/src/components/OpenDialog/Start.tsx
RUN grep -rl 'showOpenDialogOnStartup = true' ./packages/studio-base/src/Workspace.tsx \
    | xargs sed -i 's/showOpenDialogOnStartup = true/showOpenDialogOnStartup = false/g'

RUN corepack enable
RUN yarn install --immutable

ENV FOXGLOVE_DISABLE_SIGN_IN=true
RUN yarn run web:build:prod

# Release stage
FROM caddy:2.5.2-alpine
WORKDIR /src
COPY --from=build /src/studio/web/.webpack ./
COPY ./Default.json ./
COPY ./RosbotTeleop.json ./

COPY Caddyfile /etc/caddy/Caddyfile

EXPOSE 8080
# CMD ["caddy", "file-server", "--listen", ":8080"]

# disable cache
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
