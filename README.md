# Neo Downloader Backend

## Deployment
This project is configured for Docker deployment.

- **Stack**: Node.js 20 (Bookworm), Python 3.11+, FFmpeg.
- **Environment**: Render / Railway.
- **Port**: 5000.

## API Endpoints
- `POST /api/info`: Get video metadata.
- `POST /api/download`: Stream download (merging video+audio).
- `POST /api/update`: Self-update `yt-dlp` binary.
