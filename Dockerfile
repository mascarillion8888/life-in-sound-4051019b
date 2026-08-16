# syntax=docker/dockerfile:1
#
# Life in a Sound — production image.
# Multi-stage: build the Nitro server with Node, then run it.
#
# Build-time args (VITE_* are inlined into the client bundle at build time):
#   --build-arg VITE_SUPABASE_URL=...
#   --build-arg VITE_SUPABASE_ANON_KEY=...
#
# Runtime env (provider keys read via process.env at request time; never baked in):
#   -e GROQ_API_KEY -e GEMINI_API_KEY -e MISTRAL_API_KEY -e OPENROUTER_API_KEY
#   -e PORT (defaults to 3000)

ARG NODE_VERSION=22

# ----------------------------------------------------------------------------
# Stage 1 — build
# ----------------------------------------------------------------------------
FROM node:${NODE_VERSION}-slim AS build

WORKDIR /app

# Install dependencies first for better layer caching.
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the source.
COPY . .

# Build-time VITE_* args (public, RLS-enforced). Provided at docker build time.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
ENV VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}

# Produce the Nitro node-server build at .output/.
RUN npm run build

# ----------------------------------------------------------------------------
# Stage 2 — runtime
# ----------------------------------------------------------------------------
FROM node:${NODE_VERSION}-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
# Nitro node-server entry. PORT is read by Nitro; default 3000.
ENV PORT=3000
ENV HOST=0.0.0.0

# Copy only the production build output. node_modules is NOT needed at runtime
# because Nitro bundles the server into .output/server.
COPY --from=build /app/.output ./.output

EXPOSE 3000

# Healthcheck: the landing route returns 200 when the server is up.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/').then(r=>process.exit(r.status===200?0:1)).catch(()=>process.exit(1))"

CMD ["node", ".output/server/index.mjs"]
