#!/bin/sh
set -e

# check if ROSBOT_ADDR is an IPv4 address
if [[ $ROSBOT_ADDR =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  ROSBOT_IP=$ROSBOT_ADDR
# check if ROSBOT_ADDR is an IPv6 address
elif [[ $ROSBOT_ADDR =~ ^[0-9a-fA-F:]+$ ]]; then
  ROSBOT_IP="[$ROSBOT_ADDR]"
# ROSBOT_ADDR is not an IP address, look it up in /etc/hosts file
else
  # try to find the IP address associated with ROSBOT_ADDR and the "# managed by Husarnet" comment
  ROSBOT_IP="["$(grep -E "$ROSBOT_ADDR.*# managed by Husarnet$" /etc/hosts | awk '{ print $1 }')"]"

  # if no match is found, try to find any IP address associated with ROSBOT_ADDR
  if [[ "$ROSBOT_IP" == "[]" ]]; then
    ROSBOT_IP=""$(grep -m 1 -E "$ROSBOT_ADDR" /etc/hosts | awk '{ print $1 }')""
  fi
fi

# check if ROSBOT_IP is empty
if [ -z "$ROSBOT_IP" ]; then
  echo "ERROR: ROSBOT_ADDR not found in /etc/hosts"
  exit 1
fi

echo "rosbot IP is: ${ROSBOT_IP}"

# replace file:///ros2_ws with http://ROSBOT_IP:FOXGLOVE_PORT/ros2_ws in /src/rosbot_xl.urdf and /src/rosbot.urdf files
sed -i "s|file:///ros2_ws|http://$ROSBOT_IP:$FOXGLOVE_PORT/ros2_ws|g" /src/rosbot_xl.urdf /src/rosbot.urdf

# replace localhost:8080 with ROSBOT_IP:FOXGLOVE_PORT in /src/RosbotTeleop.json file
sed -i "s|localhost:8080|$ROSBOT_IP:$FOXGLOVE_PORT|g" /src/RosbotTeleop.json

# run the command passed as arguments to the script
exec "$@"
