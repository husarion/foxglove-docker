ARG FOXGLOVE_VERSION=1.84.0
ARG ROS_DISTRO=humble

# URDF stage
FROM ros:$ROS_DISTRO-ros-base as urdf_builder

SHELL ["/bin/bash", "-c"]

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
    git clone -b ros2-control https://github.com/husarion/panther_ros.git && \
    mv panther_ros/panther_description . && mv panther_ros/panther_controller . && rm -rf panther_ros


# Create URDF files (necessary with rosbridge (rosbridge do not transport mesh files))
RUN source /opt/ros/$ROS_DISTRO/setup.bash && \
    colcon build && \
    source install/setup.bash && \
    xacro /ros2_ws/src/rosbot_description/urdf/rosbot.urdf.xacro > /rosbot.urdf && \
    xacro /ros2_ws/src/rosbot_xl_description/urdf/rosbot_xl.urdf.xacro use_sim:=false simulation_controllers_config_file:=None > /rosbot_xl.urdf && \
    xacro /ros2_ws/src/panther_description/urdf/panther.urdf.xacro > /panther.urdf && \
    # Changing rotation is cause by .stl files in rosbot_ros/rosbot_description. We will change it to the .dae files.
    sed -i 's/rpy=\"1.5707963267948966 0.0 1.5707963267948966\"/rpy=\"0.0 0.0 1.5707963267948966\"/g' /rosbot.urdf

# Latest version of Foxglove: https://github.com/foxglove/studio/pkgs/container/studio
FROM ghcr.io/foxglove/studio:${FOXGLOVE_VERSION} as foxglove_build

FROM caddy:2.6.2-alpine

RUN apk update && apk add \
        bash \
        nss-tools

SHELL ["/bin/bash", "-c"]

WORKDIR /src

COPY --from=foxglove_build /src .
COPY FoxgloveDefaultLayout.json /foxglove/default-layout.json

COPY disable_cache.js /
COPY disable_interaction.js /

COPY Caddyfile /etc/caddy/
COPY Caddyfile_reverse_proxy /etc/caddy/
COPY entrypoint.sh /
COPY run.sh /

# Copy Meshes and URDFs
COPY --from=urdf_builder /ros2_ws ./ros2_ws
COPY --from=urdf_builder /rosbot.urdf .
COPY --from=urdf_builder /rosbot_xl.urdf .
COPY --from=urdf_builder /panther.urdf .

EXPOSE 8080

ENV DS_TYPE=rosbridge-websocket
ENV DS_PORT=9090
ENV UI_PORT=8080
ENV DISABLE_INTERACTION=false
ENV DISABLE_CACHE=true

# only for IPv6 -> IPv4 reverse proxy for foxglove-websocket datasource (that can listen only on IPv4)
ENV DS_HOST=

# replace package://something with http://{{placeholder "http.vars.full_host"}}:UI_PORT/ros2_ws/install/something/share/something
RUN sed -i \
    's|package://\([^/]*\)|http://{{placeholder "http.vars.full_host"}}:{{env "UI_PORT"}}/ros2_ws/install/\1/share/\1|g' \
    /src/rosbot_xl.urdf /src/rosbot.urdf /src/panther.urdf

ENTRYPOINT ["/bin/bash", "/entrypoint.sh"]
CMD /run.sh
# CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
