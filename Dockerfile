# Use Node.js 20 (Bookworm) for newer Python
FROM node:20-bookworm-slim

# Install Python, FFmpeg, and Curl
RUN apt-get update && \
    apt-get install -y python3 python3-pip ffmpeg curl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Download fresh yt-dlp binary (ensure compatibility)
RUN mkdir -p bin
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o bin/yt-dlp
RUN chmod +x bin/yt-dlp

# Copy application code (will overwrite bin/yt-dlp if it exists in source, so we do this BEFORE or use .dockerignore?)
# WE MUST DO COPY BEFORE DOWNLOAD to avoid overwriting.
# Actually, if I do COPY . . first, it copies local bin/yt-dlp.
# Then I run curl to overwrite it. reliable.

COPY . .

# Overwrite with fresh binary just in case local one was copied
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o bin/yt-dlp && chmod +x bin/yt-dlp

# Expose port
EXPOSE 5000

# Start server
CMD ["node", "index.js"]
