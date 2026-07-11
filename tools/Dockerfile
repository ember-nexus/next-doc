FROM alpine:3.23 AS core

RUN echo "http://dl-cdn.alpinelinux.org/alpine/edge/community" >> /etc/apk/repositories && \
    apk add nodejs npm pnpm git && \
    addgroup -S astro && adduser -S astro -G astro -u 1000 && \
    mkdir /core && \
    chmod 777 /core

FROM core AS dev
RUN apk add bash

FROM core AS prod-build
ARG VERSION=dev
WORKDIR /core
RUN cd /core
COPY core .
ENV CI=true
ENV VERSION=${VERSION}
RUN pnpm install && pnpm run build

FROM caddy:2.11.4-alpine AS prod
COPY --from=prod-build /core/dist /srv
COPY ./tools/Caddyfile /etc/caddy/Caddyfile
EXPOSE 80
