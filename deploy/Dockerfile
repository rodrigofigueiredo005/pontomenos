FROM node:24

WORKDIR /pontomenos

COPY server.js .
COPY app/ ./app/
COPY package.json .

RUN npm install

EXPOSE 9993

CMD ["node", "server.js"]

