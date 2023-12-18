#!/bin/bash

# Check if DS_HOST is set
if [ -z "${DS_HOST}" ]; then
    echo "DS_PORT is not set. Starting Caddy without reverse proxy configuration."
    # Start Caddy with the default Caddyfile
    caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
else
    echo "DS_HOST is set to \"${DS_HOST}\". Starting Caddy with reverse proxy configuration."
    # Start Caddy with a modified Caddyfile that includes the reverse proxy
    caddy run --config /etc/caddy/Caddyfile_reverse_proxy --adapter caddyfile
fi
