#!/usr/bin/env bash
# Runs inside the container started by test-deploy-key-ssh.sh (as root). Not for a real server.
set -uo pipefail
fails=0
sha="0123456789abcdef0123456789abcdef01234567"
tag="staging-$sha-7"

check() { # check "what" "expected" "actual"
  if [ "$2" = "$3" ]; then echo "ok   - $1"; else echo "FAIL - $1: expected '$2', got '$3'"; fails=$((fails + 1)); fi
}
has() { grep -c -- "$1" || true; }

# --- a server like DEPLOY.md prepares it ------------------------------------------
adduser -D -s /bin/bash deploy
echo 'deploy:*' | chpasswd -e 2>/dev/null # no password, but not a locked account
ssh-keygen -A >/dev/null
cat > /etc/ssh/sshd_config <<'EOF'
Port 2222
ListenAddress 127.0.0.1
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
# Forwarding is allowed server-wide: only the key's own restriction may refuse it.
AllowTcpForwarding yes
Subsystem sftp internal-sftp
EOF
mkdir -p /keys /opt/technest /home/deploy/.ssh /image/bundle
ssh-keygen -q -t ed25519 -N "" -C lead@pc -f /keys/lead
ssh-keygen -q -t ed25519 -N "" -C github-actions-deploy -f /keys/ci
# As ssh-copy-id leaves it: both keys can open a shell.
cat /keys/lead.pub /keys/ci.pub > /home/deploy/.ssh/authorized_keys
chmod 700 /home/deploy/.ssh && chmod 600 /home/deploy/.ssh/authorized_keys
printf 'GHCR_OWNER=shop\nIMAGE_TAG=staging-old\n' > /opt/technest/.env
echo "old compose" > /opt/technest/docker-compose.yml
echo "new compose" > /image/bundle/docker-compose.yml
echo "new caddyfile" > /image/bundle/Caddyfile
cp /scripts/deploy.sh /image/bundle/deploy.sh
chown -R deploy:deploy /home/deploy /opt/technest

cat > /usr/bin/docker <<'EOF'
#!/usr/bin/env bash
echo "$*" >> /opt/technest/docker-calls
case "$1" in
  create) echo "cid-1" ;;
  cp) cp -r /image/bundle/. "$3" ;;
esac
exit 0
EOF
chmod +x /usr/bin/docker
/usr/sbin/sshd || { echo "FAIL - sshd did not start"; exit 1; }

ssh_base=(-p 2222 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o BatchMode=yes -o LogLevel=ERROR)
as_ci() { ssh "${ssh_base[@]}" -i /keys/ci "$@"; }
as_lead() { ssh "${ssh_base[@]}" -i /keys/lead "$@"; }
# banner_through <key> <local port>: forwards a local port to sshd and reads what comes back.
banner_through() {
  ssh "${ssh_base[@]}" -i "$1" -f -N -L "$2:127.0.0.1:2222" deploy@127.0.0.1
  sleep 1
  timeout 3 bash -c "head -c 8 < /dev/tcp/127.0.0.1/$2" 2>/dev/null || true
  pkill -f -- "-L $2:" >/dev/null 2>&1 || true
}

echo "# before setup (the key as ssh-copy-id left it)"
check "the deploy key can open a shell" "shell" "$(as_ci deploy@127.0.0.1 'echo shell' 2>&1)"
check "the test can see a working port forward" "SSH-2.0-" "$(banner_through /keys/ci 9101)"

echo "# setup-deploy-key.sh, as root, against the real sshd configuration"
out="$(bash /scripts/setup-deploy-key.sh staging /keys/ci.pub 2>&1)"; status=$?
check "setup: exit code" "0" "$status"
check "setup: confirmed from sshd -T that passwords are refused" "1" "$(printf '%s' "$out" | has 'sshd: keys only, no password logins')"
check "setup: files belong to deploy" "deploy" "$(stat -c %U /home/deploy/.ssh/authorized_keys)"

echo "# after setup: what the deploy key can no longer do"
out="$(as_ci deploy@127.0.0.1 'echo shell' 2>&1)"; status=$?
check "a shell command: refused" "64" "$status"
check "a shell command: not run" "0" "$(printf '%s' "$out" | has '^shell$')"
check "a shell command: the gate answered" "1" "$(printf '%s' "$out" | has 'deploy-gate: refused')"
as_ci deploy@127.0.0.1 </dev/null >/dev/null 2>&1; check "an interactive login: refused" "64" "$?"
out="$(ssh "${ssh_base[@]}" -o LogLevel=INFO -i /keys/ci -tt deploy@127.0.0.1 status </dev/null 2>&1)"
check "a terminal: not given" "1" "$(printf '%s' "$out" | has 'PTY allocation request failed')"
scp -P 2222 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o BatchMode=yes -o LogLevel=ERROR \
  -i /keys/ci /etc/hostname deploy@127.0.0.1:/opt/technest/copied >/dev/null 2>&1
check "scp: fails" "1" "$([ $? -ne 0 ] && echo 1 || echo 0)"
check "scp: nothing was written" "0" "$([ -e /opt/technest/copied ] && echo 1 || echo 0)"
echo "ls /opt/technest" | sftp -P 2222 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o BatchMode=yes -o LogLevel=ERROR \
  -i /keys/ci deploy@127.0.0.1 >/dev/null 2>&1
check "sftp: fails" "1" "$([ $? -ne 0 ] && echo 1 || echo 0)"
check "local port forwarding: nothing comes through" "" "$(banner_through /keys/ci 9102)"
as_ci -o ExitOnForwardFailure=yes -R 9103:127.0.0.1:2222 deploy@127.0.0.1 status >/dev/null 2>&1
check "remote port forwarding: refused" "255" "$?"
as_ci deploy@127.0.0.1 "deploy production-$sha-7" >/dev/null 2>&1; check "a tag of the other environment: refused" "64" "$?"
as_ci deploy@127.0.0.1 "deploy $tag; id" >/dev/null 2>&1; check "a command after the tag: refused" "64" "$?"
# (the terminal test asked for `status`, which is allowed: `compose ps`)
check "none of that reached docker" "0" "$(grep -vx 'compose ps' /opt/technest/docker-calls 2>/dev/null | has .)"

echo "# after setup: what it can do"
out="$(as_ci deploy@127.0.0.1 "deploy $tag" 2>&1)"; status=$?
check "deploy: exit code" "0" "$status"
check "deploy: release files pulled from our registry" "1" "$(has "pull --quiet ghcr.io/shop/technest-deploy:$tag" < /opt/technest/docker-calls)"
check "deploy: compose file installed" "new compose" "$(cat /opt/technest/docker-compose.yml)"
check "deploy: tag recorded" "IMAGE_TAG=$tag" "$(grep '^IMAGE_TAG=' /opt/technest/.env)"
check "deploy: files still belong to deploy (the gate ran as deploy)" "deploy" "$(stat -c %U /opt/technest/.env)"
as_ci deploy@127.0.0.1 status >/dev/null 2>&1; check "status: exit code" "0" "$?"
as_ci deploy@127.0.0.1 rollback >/dev/null 2>&1; check "rollback: exit code" "0" "$?"
check "rollback: back on the previous tag" "IMAGE_TAG=staging-old" "$(grep '^IMAGE_TAG=' /opt/technest/.env)"
as_ci deploy@127.0.0.1 prune >/dev/null 2>&1; check "prune: exit code" "0" "$?"

echo "# everything else about the server is as before"
check "the lead's key still opens a shell" "shell-ok" "$(as_lead deploy@127.0.0.1 'echo shell-ok' 2>&1)"
out="$(ssh -p 2222 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o BatchMode=yes \
  -o PubkeyAuthentication=no -o PreferredAuthentications=password,keyboard-interactive deploy@127.0.0.1 true 2>&1)"
check "a login without a key is refused, no password is asked for" "1" "$(printf '%s' "$out" | has 'Permission denied (publickey')"

echo "# a server that still accepts passwords"
sed -i 's/^PasswordAuthentication no/PasswordAuthentication yes/' /etc/ssh/sshd_config
out="$(bash /scripts/setup-deploy-key.sh staging /keys/ci.pub 2>&1)"; status=$?
check "setup: exit code 2" "2" "$status"
check "setup: says not to open the port" "1" "$(printf '%s' "$out" | has 'Do NOT open port 22')"

echo
[ "$fails" -eq 0 ] && echo "all deploy key checks passed" || { echo "$fails check(s) failed"; exit 1; }
