FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Create config directory for volume mount
RUN mkdir -p /app/config

# Run as non-root user
USER node

# Start the service
CMD ["npm", "run", "dev"]
