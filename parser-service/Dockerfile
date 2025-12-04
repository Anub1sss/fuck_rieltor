FROM mcr.microsoft.com/playwright:v1.40.0-focal

WORKDIR /app

# Установка Node.js
RUN apt-get update && apt-get install -y nodejs npm

# Копирование package.json
COPY package.json ./

# Установка зависимостей
RUN npm install

# Копирование кода
COPY . .

# Установка браузеров Playwright
RUN npx playwright install chromium
RUN npx playwright install-deps chromium

EXPOSE 3000

CMD ["node", "index.js"]



