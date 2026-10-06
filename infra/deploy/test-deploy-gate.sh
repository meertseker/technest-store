#!/usr/bin/env bash
# Tests infra/deploy/deploy-gate.sh (what the deploy key may run) and
# infra/deploy/setup-deploy-key.sh (what puts the key under that restriction),
# against a stand-in `docker` that records its calls.
# Run: bash infra/deploy/test-deploy-gate.sh   (also run by CI)
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
fails=0
sha="0123456789abcdef0123456789abcdef01234567"
tag_new="staging-$sha-12"
tag_old="staging-$sha-11"

check() { # check "what" "expected" "actual"
  if [ "$2" = "$3" ]; then echo "ok   - $1"; else echo "FAIL - $1: expected '$2', got '$3'"; fails=$((fails + 1)); fi
}
inode() { ls -i "$1" | awk '{ print $1 }'; }

# new_server: a scratch /opt/technest running $tag_old, a release image to deploy, and a
# stand-in docker. FAIL_ALWAYS / FAIL_ONCE name a docker call that fails (every time / once).
new_server() {
  work="$(mktemp -d)"
  root="$work/opt"
  mkdir -p "$work/bin" "$root/bin" "$work/image/bundle"
  cp "$here/deploy-gate.sh" "$root/bin/technest-deploy-gate" # where setup-deploy-key.sh installs it
  printf 'GHCR_OWNER=shop   # lower-case\nIMAGE_TAG=%s\nOTHER=kept\n' "$tag_old" > "$root/.env"
  echo "old compose" > "$root/docker-compose.yml"
  echo "old caddyfile" > "$root/Caddyfile"
  echo "staging-older" > "$root/.previous_tag"
  echo "new compose" > "$work/image/bundle/docker-compose.yml"
  echo "new staging override" > "$work/image/bundle/docker-compose.staging.yml"
  echo "new caddyfile" > "$work/image/bundle/Caddyfile"
  cp "$here/deploy.sh" "$work/image/bundle/deploy.sh"
  : > "$work/calls"
  cat > "$work/bin/docker" <<EOF
#!/usr/bin/env bash
echo "IMAGE_TAG=\${IMAGE_TAG:-unset} \$*" >> "$work/calls"
if [ -n "\${FAIL_ALWAYS:-}" ]; then case "\$*" in *"\$FAIL_ALWAYS"*) exit 1 ;; esac; fi
if [ -n "\${FAIL_ONCE:-}" ] && [ ! -e "$work/failed-once" ]; then
  case "\$*" in *"\$FAIL_ONCE"*) touch "$work/failed-once"; exit 1 ;; esac
fi
case "\$1" in
  create) echo "cid-1" ;;
  cp) cp -r "$work/image/bundle/." "\$3" ;;
esac
case "\$*" in *" run "*) cat >/dev/null ;; esac
exit 0
EOF
  chmod +x "$work/bin/docker"
}

# gate <environment> <request...>: what sshd does for the deploy key.
gate() {
  local environment="$1"; shift
  PATH="$work/bin:$PATH" SSH_ORIGINAL_COMMAND="$*" \
    bash "$root/bin/technest-deploy-gate" $environment > "$work/out" 2>&1
  status=$?
}
calls() { grep -c -- "$1" "$work/calls" 2>/dev/null || true; }
tag() { grep -E '^IMAGE_TAG=' "$root/.env" | cut -d= -f2; }

echo "# deploy-gate.sh: requests that are refused"
new_server
refused() { # refused "what" <environment> <request>
  local what="$1"; shift
  gate "$@"
  check "refused: $what" "64" "$status"
}
refused "no request (an interactive login)" staging ""
refused "a shell" staging "bash"
refused "a shell command" staging "cat /opt/technest/.env"
refused "scp" staging "scp -t /opt/technest"
refused "sftp" staging "/usr/lib/openssh/sftp-server"
refused "deploy without a tag" staging "deploy"
refused "a tag of the other environment" staging "deploy production-$sha-12"
refused "a tag that is not commit-and-run" staging "deploy staging"
refused "a short commit" staging "deploy staging-0123abc-12"
refused "a tag with a path" staging "deploy staging-$sha-12/../../x"
refused "a second command after the tag" staging "deploy $tag_new; id"
refused "command substitution" staging "deploy staging-\$(id)-1"
refused "an extra word" staging "deploy $tag_new now"
refused "a second line" staging "deploy $tag_new
id"
refused "rollback with an argument" staging "rollback $tag_old"
refused "the old way (a script on stdin)" staging "cd /opt/technest && bash -s -- $tag_new"
refused "a key without an environment" "" "deploy $tag_new"
refused "an unknown environment" "testing" "deploy testing-$sha-1"
check "refused requests never reach docker" "0" "$(grep -c . "$work/calls")"
check "refused requests leave .env alone" "$tag_old" "$(tag)"
check "refused requests leave the compose file alone" "old compose" "$(cat "$root/docker-compose.yml")"

echo "# deploy-gate.sh: deploy"
new_server
caddy_inode="$(inode "$root/Caddyfile")"
gate staging "deploy $tag_new"
check "deploy: exit code" "0" "$status"
check "deploy: release files come from our registry, by tag" "1" "$(calls "pull --quiet ghcr.io/shop/technest-deploy:$tag_new")"
check "deploy: the release container is removed" "1" "$(calls "rm cid-1")"
check "deploy: compose file installed" "new compose" "$(cat "$root/docker-compose.yml")"
check "deploy: staging override installed" "new staging override" "$(cat "$root/docker-compose.staging.yml")"
check "deploy: Caddyfile installed" "new caddyfile" "$(cat "$root/Caddyfile")"
check "deploy: Caddyfile written in place (the container's mount still sees it)" "$caddy_inode" "$(inode "$root/Caddyfile")"
check "deploy: migrated with the new tag" "1" "$(calls "IMAGE_TAG=$tag_new compose --profile ops run --rm -T migrate")"
check "deploy: .env has the new tag" "$tag_new" "$(tag)"
check "deploy: other .env lines are kept" "1" "$(grep -c '^OTHER=kept$' "$root/.env")"
check "deploy: previous tag recorded" "$tag_old" "$(cat "$root/.previous_tag")"
check "deploy: previous compose file kept for rollback" "old compose" "$(cat "$root/.config-previous/docker-compose.yml")"
check "deploy: previous Caddyfile kept for rollback" "old caddyfile" "$(cat "$root/.config-previous/Caddyfile")"
check "deploy: no leftovers" "0" "$(ls -a "$root" | grep -c -e '^\.release-new$' -e '^\.config-saving$')"

echo "# deploy-gate.sh: rollback after that deploy"
gate staging "rollback"
check "rollback: exit code" "0" "$status"
check "rollback: .env is back on the previous tag" "$tag_old" "$(tag)"
check "rollback: compose file is the previous one" "old compose" "$(cat "$root/docker-compose.yml")"
check "rollback: Caddyfile is the previous one, in place" "old caddyfile $caddy_inode" "$(cat "$root/Caddyfile") $(inode "$root/Caddyfile")"
check "rollback: containers restarted" "2" "$(calls 'compose up -d --remove-orphans')"
check "rollback: Caddy reloaded" "2" "$(calls 'compose exec -T caddy caddy reload')"

echo "# deploy-gate.sh: a deploy that fails"
new_server
FAIL_ALWAYS="migrate" gate staging "deploy $tag_new"
check "migrate fails: exit code is not 0" "1" "$([ "$status" -ne 0 ] && echo 1 || echo 0)"
check "migrate fails: .env keeps the running tag" "$tag_old" "$(tag)"
check "migrate fails: compose file is put back" "old compose" "$(cat "$root/docker-compose.yml")"
check "migrate fails: Caddyfile is put back" "old caddyfile" "$(cat "$root/Caddyfile")"
check "migrate fails: the recorded previous tag is put back" "staging-older" "$(cat "$root/.previous_tag")"
check "migrate fails: nothing is started" "0" "$(calls 'compose up -d')"

new_server
FAIL_ONCE="up -d" gate staging "deploy $tag_new"
check "start fails: exit code is not 0" "1" "$([ "$status" -ne 0 ] && echo 1 || echo 0)"
check "start fails: .env is back on the tag that was running" "$tag_old" "$(tag)"
check "start fails: compose file is put back" "old compose" "$(cat "$root/docker-compose.yml")"
check "start fails: the old stack is started again" "2" "$(calls 'compose up -d --remove-orphans')"

new_server
FAIL_ALWAYS="up -d" gate staging "deploy $tag_new"
check "start fails and going back fails too: exit code is not 0" "1" "$([ "$status" -ne 0 ] && echo 1 || echo 0)"
check "start fails and going back fails too: says a person is needed" "1" "$(grep -c 'the server needs a person' "$work/out")"

new_server
FAIL_ALWAYS="pull --quiet ghcr.io" gate staging "deploy $tag_new"
check "no such release image: exit code is not 0" "1" "$([ "$status" -ne 0 ] && echo 1 || echo 0)"
check "no such release image: compose file untouched" "old compose" "$(cat "$root/docker-compose.yml")"
check "no such release image: .env untouched" "$tag_old" "$(tag)"
check "no such release image: nothing else is run" "1" "$(grep -c . "$work/calls")"

new_server
rm "$work/image/bundle/deploy.sh"
gate staging "deploy $tag_new"
check "release image without deploy.sh: refused" "64" "$status"
check "release image without deploy.sh: compose file untouched" "old compose" "$(cat "$root/docker-compose.yml")"

new_server
sed -i 's/^GHCR_OWNER=.*/GHCR_OWNER=evil.example\/x/' "$root/.env"
gate staging "deploy $tag_new"
check "odd GHCR_OWNER: refused" "64" "$status"
check "odd GHCR_OWNER: nothing is pulled" "0" "$(calls pull)"

echo "# deploy-gate.sh: first deploy on an empty server"
new_server
rm "$root/docker-compose.yml" "$root/Caddyfile" "$root/.previous_tag"
printf 'GHCR_OWNER=shop\nIMAGE_TAG=                 # written by the Deploy workflow\n' > "$root/.env"
gate staging "deploy $tag_new"
check "first deploy: exit code" "0" "$status"
check "first deploy: compose file installed" "new compose" "$(cat "$root/docker-compose.yml")"
check "first deploy: .env has the tag" "$tag_new" "$(tag)"
check "first deploy: no previous tag (the template's comment is not a tag)" "" "$(cat "$root/.previous_tag")"
gate staging "rollback"
check "first deploy: rollback has nothing to go back to and says so" "64" "$status"
check "first deploy: a refused rollback leaves the tag" "$tag_new" "$(tag)"

new_server
rm "$root/.env"
gate staging "deploy $tag_new"
check "no .env on the server: refused" "64" "$status"
check "no .env on the server: nothing is pulled" "0" "$(calls pull)"

new_server
TECHNEST_ROOT="$work/elsewhere" gate staging "deploy $tag_new"
check "the stack directory cannot be chosen through the environment" "new compose" "$(cat "$root/docker-compose.yml")"

echo "# deploy-gate.sh: prune and status"
new_server
gate staging "prune"
check "prune: exit code" "0" "$status"
check "prune: only images older than two weeks" "1" "$(calls 'image prune -af --filter until=336h')"
gate production "status"
check "status: exit code" "0" "$status"
check "status: compose ps" "1" "$(calls 'compose ps')"

echo "# setup-deploy-key.sh"
# Made-up ed25519 public keys of the right shape (68 base64 characters).
blob() { printf 'AAAAC3NzaC1lZDI1NTE5AAAAI%s' "$(printf "$1%.0s" $(seq 1 43))"; }
lead_key="ssh-ed25519 $(blob L) lead@pc"
ci_blob="$(blob C)"
ci_key="ssh-ed25519 $ci_blob github-actions-deploy"
ci_blob2="$(blob N)"

# new_home: a server where the lead's key and (from an earlier ssh-copy-id) the deploy key can both open a shell.
new_home() {
  work="$(mktemp -d)"
  root="$work/opt"; home="$work/home/deploy"
  mkdir -p "$root" "$home/.ssh" "$work/bin" "$work/keys"
  printf '%s\n%s\n' "$lead_key" "$ci_key" > "$home/.ssh/authorized_keys"
  echo "$ci_key" > "$work/keys/ci.pub"
}
setup() { # setup <args...>
  PATH="$work/bin:$PATH" TECHNEST_ROOT="$root" DEPLOY_HOME="$home" \
    bash "$here/setup-deploy-key.sh" "$@" > "$work/out" 2>&1
  status=$?
}
auth() { cat "$home/.ssh/authorized_keys"; }

new_home
setup staging "$work/keys/ci.pub"
check "setup: exit code" "0" "$status"
check "setup: the gate is installed" "1" "$([ -x "$root/bin/technest-deploy-gate" ] && cmp -s "$here/deploy-gate.sh" "$root/bin/technest-deploy-gate" && echo 1 || echo 0)"
check "setup: the deploy key is listed once" "1" "$(auth | grep -c "$ci_blob")"
check "setup: ...restricted to the gate for this environment" \
  "restrict,command=\"$root/bin/technest-deploy-gate staging\" ssh-ed25519 $ci_blob technest-deploy-ci-staging" \
  "$(auth | grep "$ci_blob")"
check "setup: the lead's key is kept as it was" "1" "$(auth | grep -cxF "$lead_key")"
check "setup: a copy of the old file is kept" "2" "$(grep -c . "$home/.ssh/authorized_keys.before-deploy-key")"
check "setup: says the password check still has to be done by hand (not root)" "1" "$(grep -c 'NOT CHECKED' "$work/out")"

setup staging "$work/keys/ci.pub"
check "setup twice: still one deploy line" "1" "$(auth | grep -c "$ci_blob")"
check "setup twice: two lines in total" "2" "$(auth | grep -c .)"

echo "ssh-ed25519 $ci_blob2 rotated" > "$work/keys/ci2.pub"
setup staging "$work/keys/ci2.pub"
check "new key: the old deploy key is gone" "0" "$(auth | grep -c "$ci_blob")"
check "new key: the new one is restricted" "1" "$(auth | grep -c "^restrict,command=.* ssh-ed25519 $ci_blob2 ")"
check "new key: the lead's key is kept" "1" "$(auth | grep -cxF "$lead_key")"

new_home
echo "$lead_key" > "$work/keys/lead.pub"
printf '%s\n' "$lead_key" > "$home/.ssh/authorized_keys"
setup staging "$work/keys/lead.pub"
check "own key passed by mistake: refused (it would lock the lead out)" "1" "$status"
check "own key passed by mistake: authorized_keys unchanged" "$lead_key" "$(auth)"

new_home
before="$(auth)"
printf -- '-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAA\n-----END OPENSSH PRIVATE KEY-----\n' > "$work/keys/private"
setup staging "$work/keys/private"
check "private key file: refused" "1" "$status"
echo "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC7 old@rsa" > "$work/keys/rsa.pub"
setup staging "$work/keys/rsa.pub"
check "rsa key: refused" "1" "$status"
printf '%s\n%s\n' "$ci_key" "$lead_key" > "$work/keys/two.pub"
setup staging "$work/keys/two.pub"
check "two keys in the file: refused" "1" "$status"
setup staging "$work/keys/missing.pub"
check "missing key file: refused" "1" "$status"
setup live "$work/keys/ci.pub"
check "unknown environment: refused" "1" "$status"
check "refused runs leave authorized_keys alone" "$before" "$(auth)"

# As root the script checks the sshd configuration in force. Stand-ins for id, sshd,
# systemctl and chown play a server.
as_root() { # as_root <sshd -T output> <fail2ban state>
  new_home
  printf '#!/usr/bin/env bash\n[ "$1" = "-u" ] && echo 0 || echo "uid=0(root)"\n' > "$work/bin/id"
  printf '#!/usr/bin/env bash\ncat <<EOF2\n%s\nEOF2\n' "$1" > "$work/bin/sshd"
  printf '#!/usr/bin/env bash\n[ "%s" = "active" ]\n' "$2" > "$work/bin/systemctl"
  printf '#!/usr/bin/env bash\necho "chown $*" >> "%s/chown-calls"\n' "$work" > "$work/bin/chown"
  chmod +x "$work/bin/id" "$work/bin/sshd" "$work/bin/systemctl" "$work/bin/chown"
  setup production "$work/keys/ci.pub"
}
good="passwordauthentication no
kbdinteractiveauthentication no
permitrootlogin no
pubkeyauthentication yes"

as_root "$good" active
check "root, keys only, fail2ban on: exit code" "0" "$status"
check "root: says so" "1" "$(grep -c 'keys only, no password logins. fail2ban: running.' "$work/out")"
check "root: files handed to the deploy user" "1" "$(grep -c "chown -R deploy:deploy $home/.ssh $root/bin" "$work/chown-calls")"
check "root: key restricted for production" "1" "$(auth | grep -c 'technest-deploy-gate production" ssh-ed25519')"

as_root "${good/passwordauthentication no/passwordauthentication yes}" active
check "passwords accepted: exit code 2" "2" "$status"
check "passwords accepted: told not to open the port" "1" "$(grep -c 'Do NOT open port 22' "$work/out")"
check "passwords accepted: the key is restricted all the same" "1" "$(auth | grep -c '^restrict,command=')"

as_root "${good/kbdinteractiveauthentication no/kbdinteractiveauthentication yes}" active
check "keyboard-interactive accepted: exit code 2" "2" "$status"
as_root "${good/permitrootlogin no/permitrootlogin yes}" active
check "root password login allowed: exit code 2" "2" "$status"
as_root "$good" inactive
check "fail2ban not running: exit code 2" "2" "$status"

echo
[ "$fails" -eq 0 ] && echo "all deploy-gate checks passed" || { echo "$fails check(s) failed"; exit 1; }
