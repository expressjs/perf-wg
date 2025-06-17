#! /bin/bash
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)
TOKEN=$(cat $SCRIPT_DIR/.do_key)

CLOUD_CONFIG=$(cat <<EOM
write_files:
- path: /etc/environment
  content: |
    BENCH_GIT_URL="${1}"
    BENCH_GIT_REF="${2}"
    BENCH_PATH="${3}"
  append: true
- path: /root/setup.sh
  owner: 'root:root'
  permissions: '0644'
  content: |
    
- path: /etc/systemd/system/bench
  content: |
    [Unit]
    Description=Run Benchmark Setup
    After=network.target

    [Service]
    User=root
    Group=root
    WorkingDirectory=/root
    ExecStart=/root/setup.sh

    [Install]
    WantedBy=multi-user.target
EOM)

BODY=$(cat <<EOM
{
  "name":"ubuntu-s-1vcpu-512mb-10gb-sfo3-01",
  "size":"s-1vcpu-512mb-10gb",
  "region":"sfo3",
  "image":"ubuntu-24-10-x64",
  "ssh_keys": ["fd:6b:b4:20:b9:d4:9d:59:0d:24:ba:7b:b0:02:90:b3"],
  "monitoring":true,
  "with_droplet_agent": false,
  "user_data": "${CLOUD_CONFIG}"
}
EOM)

curl -X POST -H 'Content-Type: application/json' \
    -H "Authorization: Bearer $TOKEN" \
    -d "$BODY" \
    "https://api.digitalocean.com/v2/droplets"

