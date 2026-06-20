FROM alpine:3.23 AS core

RUN echo "http://dl-cdn.alpinelinux.org/alpine/edge/community" >> /etc/apk/repositories && \
    apk add nodejs npm pnpm git && \
    addgroup -S astro && adduser -S astro -G astro -u 1000 && \
    mkdir /core && \
    chmod 777 /core

FROM core AS dev
RUN apk add bash

FROM core AS prod-build
WORKDIR /core
USER astro
RUN cd /core
COPY . .
RUN pnpm install && pnpm run build

FROM nginx:alpine3.23 AS prod
COPY ./tools/nginx.conf /etc/nginx/nginx.conf
COPY --from=prod-build /core/dist /usr/share/nginx/html
EXPOSE 80
