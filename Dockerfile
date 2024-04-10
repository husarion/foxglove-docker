ARG ROS_DISTRO=humble

# =========================== URDF builder ===============================
FROM ros:$ROS_DISTRO-ros-base as urdf_builder
WORKDIR /ros2_ws

# Clone repos with Mesh and URDF
RUN apt update && \
    apt-get install -y \
        subversion \
        ros-$ROS_DISTRO-xacro && \
    mkdir src && \
    cd ./src && \
    # Clone rosbot_description
    git clone  https://github.com/husarion/rosbot_ros.git && \
    mv rosbot_ros/rosbot_description . && rm -rf rosbot_ros && \
    # Clone rosbot_xl_description
    git clone  https://github.com/husarion/rosbot_xl_ros.git && \
    mv rosbot_xl_ros/rosbot_xl_description . && rm -rf rosbot_xl_ros && \
    # Clone ros_components_description
    git clone https://github.com/husarion/ros_components_description.git && \
    # Clone open_manipulator_x_description
    git clone  https://github.com/husarion/open_manipulator_x.git && \
    mv open_manipulator_x/open_manipulator_x_description . && rm -rf open_manipulator_x && \
    # Clone panther_description (TODO: Change branch after first release of ROS 2)
    git clone -b ros2-devel https://github.com/husarion/panther_ros.git && \
    mv panther_ros/panther_description . && mv panther_ros/panther_controller . && rm -rf panther_ros

# =========================== Foxglove builder ===============================
FROM node:16 as foxglove_build
WORKDIR /src

RUN apt-get update && \
    apt-get install -y git-lfs && \
    git clone -b studio https://github.com/husarion/foxglove-docker . && \
    git lfs pull

RUN corepack enable
RUN yarn install --immutable

RUN yarn run web:build:prod

# =========================== Release stage ===============================
FROM caddy:2.6.2-alpine
WORKDIR /src

RUN apk update && apk add \
        bash \
        nss-tools

COPY --from=foxglove_build /src/web/.webpack ./

COPY disable_cache.js /
COPY disable_interaction.js /

COPY Caddyfile /etc/caddy/
COPY Caddyfile_reverse_proxy /etc/caddy/
COPY entrypoint.sh /
COPY run.sh /

# Copy Meshes and URDFs
COPY --from=urdf_builder /ros2_ws ./ros2_ws

EXPOSE 8080

ENV DS_TYPE=rosbridge-websocket
ENV DS_PORT=9090
ENV UI_PORT=8080
ENV DISABLE_INTERACTION=false
ENV DISABLE_CACHE=true

# only for IPv6 -> IPv4 reverse proxy for foxglove-websocket datasource (that can listen only on IPv4)
ENV DS_HOST=

ENTRYPOINT ["/bin/bash", "/entrypoint.sh"]
CMD /run.sh
# CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
