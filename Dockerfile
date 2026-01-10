FROM python:3.10-slim AS builder

WORKDIR /app

RUN apt-get update \
  && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends nodejs npm ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}

ARG VITE_API_KEY=
ENV VITE_API_KEY=${VITE_API_KEY}

ARG VITE_APP_VERSION=
ENV VITE_APP_VERSION=${VITE_APP_VERSION}

ARG VITE_BUILD_SHA=
ENV VITE_BUILD_SHA=${VITE_BUILD_SHA}

ARG VITE_BUILD_TIME=
ENV VITE_BUILD_TIME=${VITE_BUILD_TIME}

RUN printf "VITE_API_URL=%s\nVITE_API_KEY=%s\nVITE_APP_VERSION=%s\nVITE_BUILD_SHA=%s\nVITE_BUILD_TIME=%s\n" \
    "$VITE_API_URL" "$VITE_API_KEY" "$VITE_APP_VERSION" "$VITE_BUILD_SHA" "$VITE_BUILD_TIME" \
    > .env.production.local \
  && npm run build \
  && rm -f .env.production.local


FROM python:3.10-slim

RUN apt-get update \
  && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends nginx ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && rm -f /etc/nginx/sites-enabled/default \
  && ln -sf /dev/stdout /var/log/nginx/access.log \
  && ln -sf /dev/stderr /var/log/nginx/error.log

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/sites-enabled/default

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
