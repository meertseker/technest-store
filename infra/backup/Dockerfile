# Hourly Postgres backup to Cloudflare R2 (S3 API) with 30-day retention.
# A loop runs backup.sh as a non-root user; see entrypoint.sh and DEPLOY.md ("Yedekleme").
# /var/lib/backup holds the time of the last good backup: mount a volume there, or every
# deploy resets the health check's clock.
# The base image is pinned by digest (a floating tag could change under a deploy); bump the
# digest with the Alpine release, and raise postgresql<major>-client with the Postgres major.
FROM alpine:3.22@sha256:5291449c3df73caf6ed85e649dec1b9e818b39a5d8c871e97afc13e9cd5e8fa8
RUN apk add --no-cache postgresql16-client rclone bash coreutils tzdata ca-certificates curl age \
 && adduser -D -u 10001 backup \
 && mkdir -p /var/lib/backup && chown backup /var/lib/backup
COPY --chmod=755 backup.sh restore.sh healthcheck.sh entrypoint.sh /usr/local/bin/
ENV TZ=Europe/London \
    BACKUP_EVERY_MINUTES=60 \
    BACKUP_RETENTION_DAYS=30
VOLUME /var/lib/backup
USER backup
HEALTHCHECK --interval=10m --timeout=10s --start-period=5m CMD /usr/local/bin/healthcheck.sh
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
