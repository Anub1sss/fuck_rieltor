FROM mcr.microsoft.com/playwright:v1.40.0-focal

WORKDIR /app

COPY package.json ./

RUN npm install

COPY . .

RUN npx playwright install chromium
RUN npx playwright install-deps chromium

EXPOSE 3000

CMD ["node", "index.js"]










