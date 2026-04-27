FROM debian:12-slim AS core
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl ca-certificates git && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    npm install -g pnpm && \
    curl https://install.duckdb.org | sh && \
    groupadd --system astro && useradd --system --gid astro --uid 1000 astro && \
    mkdir /core && \
    chmod 777 /core && \
    rm -rf /var/lib/apt/lists/*

FROM core AS dev
RUN apt-get update && \
    apt-get install -y --no-install-recommends bash && \
    rm -rf /var/lib/apt/lists/*

#FROM alpine:3.23 AS core
#
#RUN echo "http://dl-cdn.alpinelinux.org/alpine/edge/community" >> /etc/apk/repositories && \
#    apk add nodejs npm pnpm git && \
#    addgroup -S astro && adduser -S astro -G astro -u 1000 && \
#    mkdir /core && \
#    chmod 777 /core
#
#FROM core AS dev
#RUN apk add bash

#FROM core AS prod-build
#WORKDIR /core
#USER astro
#RUN cd /core
#COPY . .
#RUN pnpm install && pnpm run build
#
#FROM nginx:alpine3.23 AS prod
#COPY ./tools/nginx.conf /etc/nginx/nginx.conf
#COPY --from=prod-build /core/dist /usr/share/nginx/html
#EXPOSE 80
