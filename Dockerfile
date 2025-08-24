# Use the official Node.js 18 image as base
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install dependencies including devDependencies for TypeScript compilation
RUN npm ci

# Copy the rest of the application code
COPY . .

# Compile TypeScript to JavaScript
RUN npm run build

# Create a non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S expressjs -u 1001

# Change ownership of the app directory
RUN chown -R expressjs:nodejs /app
USER expressjs

# Expose the port the app runs on
EXPOSE 5000

# Set environment to development
ENV NODE_ENV=development

# Start the development server (uses nodemon for hot reloading)
CMD ["npm", "run", "dev"]
