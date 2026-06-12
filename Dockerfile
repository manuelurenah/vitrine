# Production image for vitrine.
#
# Build context is the PARENT directory containing both checkouts, because
# package.json depends on `file:../civitai-app-starters/packages/civitai-app-sdk`
# (uncompiled ESM transpiled by Next via transpilePackages):
#
#   workspace/
#     vitrine/                       <- this repo
#     civitai-app-starters/          <- github.com/civitai/civitai-app-starters
#
#   docker build -f vitrine/Dockerfile .
#
# Single stage on purpose: the runtime image keeps devDependencies so the
# Kubernetes initContainer can run drizzle-kit migrations
# (`node ./node_modules/drizzle-kit/bin.cjs migrate`).
FROM node:24-alpine

RUN npm install -g pnpm@10

WORKDIR /workspace
COPY civitai-app-starters/packages/civitai-app-sdk ./civitai-app-starters/packages/civitai-app-sdk
COPY vitrine ./vitrine

WORKDIR /workspace/vitrine
# --no-frozen-lockfile: the app-sdk is resolved from a sibling checkout of
# civitai-app-starters@main, which can drift ahead of this repo's lockfile.
RUN pnpm install --no-frozen-lockfile

# NEXT_PUBLIC_* vars are inlined into the client bundle at build time.
ARG NEXT_PUBLIC_APP_URL=https://vitrine.civitai.com
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

# Server env (OAuth creds, DB, S3, Redis) is provided at runtime by the
# deployment; skip t3-env build-time validation.
RUN SKIP_ENV_VALIDATION=1 NODE_ENV=production pnpm build

ENV NODE_ENV=production
EXPOSE 3000
CMD ["./node_modules/.bin/next", "start", "-p", "3000"]
