# Use Node.js 18 as base
FROM node:18-bullseye-slim

# Install Python and FFmpeg (Required for yt-dlp)
RUN apt-get update && \
    apt-get install -y python3 python3-pip ffmpeg && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy application code
COPY . .

# Ensure binaries have execution permissions (if committed)
# But we will likely download fresh yt-dlp anyway or use the one in repo
RUN chmod +x server/bin/yt-dlp || true

# Expose port
EXPOSE 5000

# Start server
CMD ["node", "server/index.js"]
