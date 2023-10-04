#!/bin/bash

# replace localhost:8080 with {{.Host}}:UI_PORT in /foxglove/default-layout.json file
sed -i 's|localhost:8080|{{.Host}}:{{env "UI_PORT"}}|g' /foxglove/default-layout.json

# Optionally override the default layout with one provided via bind mount
index_html=$(cat index.html)
replace_pattern='/*FOXGLOVE_STUDIO_DEFAULT_LAYOUT_PLACEHOLDER*/'
replace_value=$(cat /foxglove/default-layout.json)
echo "${index_html/"$replace_pattern"/$replace_value}" > index.html

# Continue executing the CMD
exec "$@"