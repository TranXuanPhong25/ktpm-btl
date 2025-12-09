FROM oven/bun:1.1-alpine

WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

COPY . .

EXPOSE 5005
CMD ["bun", "run", "dev"]