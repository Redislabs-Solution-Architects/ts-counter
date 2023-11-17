FROM node:lts-slim
WORKDIR /app
COPY ./package*.json .
RUN npm install
COPY ./src/app.js .
COPY ./src/intervals.js .
EXPOSE 8000
CMD ["node", "app.js"]