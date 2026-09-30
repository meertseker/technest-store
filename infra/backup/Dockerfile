# Nightly Postgres backup to Cloudflare R2 (S3 API) with 30-day retention.
# A daily loop runs backup.sh as a non-root user; see entrypoint.sh and DEPLOY.md ("Yedekleme").
FROM alpine:3.20
RUN apk add --no-cache postgresql16-client rclone bash coreutils tzdata ca-certificates \
 && adduser -D -u 10001 backup \
 && mkdir -p /var/lib/backup && chown backup /var/lib/backup
COPY --chmod=755 backup.sh restore.sh healthcheck.sh entrypoint.sh /usr/local/bin/
ENV TZ=Europe/London \
    BACKUP_AT=03:15 \
    BACKUP_RETENTION_DAYS=30
USER backup
HEALTHCHECK --interval=1h --timeout=10s --start-period=5m CMD /usr/local/bin/healthcheck.sh
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
