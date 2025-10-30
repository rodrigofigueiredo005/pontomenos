FROM node:20-alpine

WORKDIR /app

RUN npm install -g http-server

COPY server.js .
COPY app/ ./app/

EXPOSE 8000 8787

CMD ["sh", "-c", "node server.js & http-server app -p 8000 -c-1 --cors"]

