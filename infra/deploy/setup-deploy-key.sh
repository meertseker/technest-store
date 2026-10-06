#!/usr/bin/env bash
# Run once per server, on the server, as the `deploy` user (or as root):
#   bash setup-deploy-key.sh <staging|production> <public key file>
# with deploy-gate.sh in the same directory.
#
# It makes the GitHub Actions deploy key a key that can do one thing:
#   - installs deploy-gate.sh as /opt/technest/bin/technest-deploy-gate
#   - lists the key in ~deploy/.ssh/authorized_keys as
#       restrict,command="/opt/technest/bin/technest-deploy-gate <environment>" ssh-ed25519 ...
#     `restrict` switches off terminals, port, agent and X11 forwarding and ~/.ssh/rc;
#     `command=` makes sshd run the gate whatever the client asked for.
#   - removes any other line for the same key (an earlier ssh-copy-id leaves the key
#     in the file without restrictions)
# Every other key in the file is kept, and the script refuses to finish if no key that
# can open a shell would be left: that would lock you out of the server.
#
# Safe to run again (new key, or after deploy-gate.sh changed).
# Tested by infra/deploy/test-deploy-gate.sh.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
environment="${1:-}"
key_file="${2:-}"
deploy_user="${DEPLOY_USER:-deploy}"
deploy_home="${DEPLOY_HOME:-/home/$deploy_user}"
root="${TECHNEST_ROOT:-/opt/technest}"
gate="$root/bin/technest-deploy-gate"
marker="technest-deploy-ci"

die() {
  echo "setup-deploy-key: $1" >&2
  exit 1
}

case "$environment" in
  staging | production) ;;
  *) die "usage: setup-deploy-key.sh <staging|production> <public key file>" ;;
esac
[ -f "$key_file" ] || die "public key file '$key_file' not found"
[ -f "$here/deploy-gate.sh" ] || die "deploy-gate.sh must be next to this script"
[ -d "$root" ] || die "$root does not exist (server preparation, DEPLOY.md)"

# One public key, ed25519, nothing else in the file.
[ "$(grep -cv '^[[:space:]]*$' "$key_file")" = "1" ] || die "'$key_file' must hold exactly one public key"
read -r key_type key_blob _ < <(grep -v '^[[:space:]]*$' "$key_file")
[ "$key_type" = "ssh-ed25519" ] || die "'$key_file' is not an ed25519 public key (did you pass the private key?)"
[[ "$key_blob" =~ ^AAAAC3NzaC1lZDI1NTE5[A-Za-z0-9+/]{48}=*$ ]] || die "'$key_file' does not look like an ed25519 public key"

# --- the gate -----------------------------------------------------------------
mkdir -p "$root/bin"
cp "$here/deploy-gate.sh" "$gate.new"
chmod 755 "$gate.new"
mv "$gate.new" "$gate"

# --- authorized_keys ------------------------------------------------------------
ssh_dir="$deploy_home/.ssh"
auth="$ssh_dir/authorized_keys"
mkdir -p "$ssh_dir"
touch "$auth"

new="$(mktemp "$ssh_dir/authorized_keys.new.XXXXXX")"
trap 'rm -f "$new"' EXIT
# Everything except earlier lines for this key and earlier deploy-key lines for this environment.
grep -vF -- "$key_blob" "$auth" | grep -v -- " $marker-$environment\$" > "$new" || true
kept="$(grep -c . "$new" || true)"
printf 'restrict,command="%s %s" %s %s %s\n' "$gate" "$environment" "$key_type" "$key_blob" "$marker-$environment" >> "$new"

# A line that starts with the key type has no options: that key can open a shell.
shell_keys="$(grep -cE '^(ssh-|ecdsa-|sk-)' "$new" || true)"
if [ "$shell_keys" = "0" ] && [ "${ALLOW_NO_SHELL_KEY:-}" != "yes" ]; then
  die "after this change no key in $auth could open a shell (is '$key_file' your own key instead of the deploy key?). Nothing was changed."
fi

if [ -s "$auth" ]; then
  cp -p "$auth" "$auth.before-deploy-key"
fi
chmod 600 "$new"
mv "$new" "$auth"
trap - EXIT
chmod 700 "$ssh_dir"
if [ "$(id -u)" = "0" ]; then
  chown -R "$deploy_user:$deploy_user" "$ssh_dir" "$root/bin"
fi

echo "Deploy key for $environment is restricted to: $gate $environment"
echo "Other keys kept in $auth: $kept (a copy of the old file: $auth.before-deploy-key)"

# --- is password login really off? ------------------------------------------------
# Port 22 is about to be opened to the internet for this key. That is only acceptable
# while sshd accepts keys only. `sshd -T` prints the configuration in force (including
# files under sshd_config.d, which win over sshd_config) but needs root.
problems=0
if [ "$(id -u)" = "0" ] && command -v sshd >/dev/null 2>&1; then
  effective="$(sshd -T 2>/dev/null || true)"
  setting() { printf '%s\n' "$effective" | awk -v k="$1" '$1 == k { print $2 }' | head -1; }
  [ "$(setting passwordauthentication)" = "no" ] || { echo "PROBLEM: sshd accepts passwords (PasswordAuthentication is not 'no')" >&2; problems=1; }
  [ "$(setting kbdinteractiveauthentication)" = "no" ] || { echo "PROBLEM: sshd accepts keyboard-interactive logins (KbdInteractiveAuthentication is not 'no')" >&2; problems=1; }
  case "$(setting permitrootlogin)" in
    no | prohibit-password | without-password) ;;
    *) echo "PROBLEM: root can log in with a password (PermitRootLogin)" >&2; problems=1 ;;
  esac
  fail2ban="running"
  if ! command -v systemctl >/dev/null 2>&1; then
    fail2ban="NOT CHECKED (no systemctl here)"
  elif ! systemctl is-active --quiet fail2ban; then
    echo "PROBLEM: fail2ban is not running (apt -y install fail2ban)" >&2
    problems=1
  fi
  if [ "$problems" = "0" ]; then
    echo "sshd: keys only, no password logins. fail2ban: $fail2ban."
  fi
else
  echo
  echo "NOT CHECKED (needs root): that sshd refuses passwords. Before you open port 22, run from your own computer:"
  echo "  ssh -o PubkeyAuthentication=no -o PreferredAuthentications=password,keyboard-interactive $deploy_user@SERVER_IP"
  echo "It must answer 'Permission denied (publickey)' without asking for a password."
fi

echo
echo "Check from your own computer (the key may only deploy):"
echo "  ssh -i DEPLOY_PRIVATE_KEY $deploy_user@SERVER_IP whoami     -> 'deploy-gate: refused: ...'"
echo "  ssh -i DEPLOY_PRIVATE_KEY $deploy_user@SERVER_IP status     -> docker compose ps"
if [ "$problems" != "0" ]; then
  echo
  echo "Do NOT open port 22 to the internet until the problems above are fixed." >&2
  exit 2
fi
