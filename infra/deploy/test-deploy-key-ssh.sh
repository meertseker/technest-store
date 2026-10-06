#!/usr/bin/env bash
# The deploy key against a real sshd (OpenSSH in an Alpine container): after
# setup-deploy-key.sh the key can ask the gate for a deploy and nothing else: no shell,
# no terminal, no file copy, no port forwarding. The lead's own key still gets a shell,
# and passwords are refused. `docker` inside the container is a stand-in that records calls.
# Needs docker and network access (apk). Run: bash infra/deploy/test-deploy-key-ssh.sh   (also run by CI)
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
image="${SSH_TEST_IMAGE:-alpine:3.20}"
name="technest-sshtest-$$"

export MSYS_NO_PATHCONV=1
hostpath() { if command -v cygpath >/dev/null 2>&1; then cygpath -m "$1"; else printf '%s' "$1"; fi; }
trap 'docker rm -f "$name" >/dev/null 2>&1' EXIT

docker create --name "$name" "$image" sh -c 'apk add --no-cache openssh bash >/dev/null && exec bash /scripts/inside.sh' >/dev/null \
  || { echo "FAIL - could not create the test container"; exit 1; }
docker cp "$(hostpath "$here")" "$name:/scripts" >/dev/null
docker cp "$(hostpath "$here/test-deploy-key-ssh.inside.sh")" "$name:/scripts/inside.sh" >/dev/null
docker start -a "$name"
