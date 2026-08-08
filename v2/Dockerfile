FROM node:22-alpine

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8080

WORKDIR /app
COPY data ./data
COPY v2 ./v2
WORKDIR /app/v2

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/api/v1/health').then(r=>{if(!r.ok)process.exit(1);return r.json()}).then(d=>{if(d.status==='unavailable')process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "server/index.mjs"]
