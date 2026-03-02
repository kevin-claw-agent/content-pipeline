# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-03-02

### Added
- Initial release of Content Pipeline
- Multi-Agent Content Pipeline for AI short drama production
- Script Agent: Story premise to full script generation
- Visual Agent: Script to storyboard descriptions
- Render Agent: Storyboard to video clips generation
- Composer: Video clips to final composition
- RESTful API with Express.js
- BullMQ-based job queue system
- PostgreSQL for state management
- MinIO/S3 for asset storage
- Docker and Docker Compose support
- GitHub Pages demo deployment
- Comprehensive test suite with Jest
- TypeScript implementation throughout

### Features
- Episode management (create, list, get status)
- Multi-stage pipeline processing
- Job retry mechanism with exponential backoff
- Asset management and storage
- Real-time status tracking
- Example library with 5 genres (mystery, romance, horror, comedy, scifi)
- Interactive demo website

### Technical
- Node.js 18+ runtime
- TypeScript 5.2+
- Express.js 4.18+
- BullMQ 5.0+
- PostgreSQL 14+
- Redis 7+
- Docker support

[1.0.0]: https://github.com/kevin-claw-agent/content-pipeline/releases/tag/v1.0.0
