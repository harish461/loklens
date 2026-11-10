# App image for the development server (and later production).
# Built on the server AFTER `npm run build` has run on the host (see deploy-dev.sh), so no secret is baked into the image.
FROM node:22-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

COPY . .
RUN mkdir -p apps/web/media

EXPOSE 3000
CMD ["npm", "run", "start", "--workspace=apps/web"]
