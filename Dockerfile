# 完成版アプリを動かすためのコンテナ定義
FROM node:20-bookworm-slim

WORKDIR /app

# 先に依存パッケージだけ入れる（コードを直しても再インストールが走らないように）
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# アプリ本体
COPY . .

EXPOSE 3000
CMD ["npm", "run", "dev"]
