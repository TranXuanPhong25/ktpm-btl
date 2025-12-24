FROM oven/bun:1.1-alpine

WORKDIR /app

# Copy package files
COPY package.json bun.lock* ./

# Install dependencies
RUN bun install --frozen-lockfile --production

# Copy application code
COPY . .

# Create config directory for volume mount
RUN mkdir -p /app/config

# Run as non-root user
USER bun

CMD ["npm", "run", "dev"]
