FROM node:16 as dependencies
WORKDIR /nft-sales-bot-main
COPY package.json .env sales_bot.js  ./
RUN npm install
EXPOSE 4000
CMD ["node", "sales_bot.js"]
