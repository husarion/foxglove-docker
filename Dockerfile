ARG ROS_DISTRO=humble

# URDF stage
FROM ros:$ROS_DISTRO-ros-base as urdf_builder

SHELL ["/bin/bash", "-c"]

WORKDIR /ros2_ws

RUN apt update && \
    apt-get install -y \
        subversion \
        ros-$ROS_DISTRO-xacro && \
    mkdir src && \
    cd ./src && \
    svn checkout https://github.com/husarion/rosbot_ros/trunk/rosbot_description && \
    svn checkout https://github.com/husarion/rosbot_xl_ros/trunk/rosbot_xl_description && \
    git clone https://github.com/husarion/ros_components_description.git && \
    svn checkout https://github.com/husarion/open_manipulator_x/trunk/open_manipulator_x_description && \
    git clone -b ros2-control https://github.com/husarion/panther_ros.git && \
    rm -rf /ros2_ws/src/panther_ros/panther && \
    rm -rf /ros2_ws/src/panther_ros/panther_battery && \
    rm -rf /ros2_ws/src/panther_ros/panther_controller && \
    rm -rf /ros2_ws/src/panther_ros/panther_hardware_interfaces && \
    rm -rf /ros2_ws/src/panther_ros/panther_utils

RUN source /opt/ros/$ROS_DISTRO/setup.bash && \
    colcon build && \
    source install/setup.bash && \
    xacro /ros2_ws/src/rosbot_description/urdf/rosbot.urdf.xacro > /rosbot.urdf && \
    xacro /ros2_ws/src/rosbot_xl_description/urdf/rosbot_xl.urdf.xacro use_sim:=false simulation_controllers_config_file:=None > /rosbot_xl.urdf && \
    xacro /ros2_ws/src/panther_ros/panther_description/urdf/panther.urdf.xacro > /panther.urdf && \
    # Changing rotation is cause by .stl files in rosbot_ros/rosbot_description. We will change it to the .dae files.
    sed -i 's/rpy=\"1.5707963267948966 0.0 1.5707963267948966\"/rpy=\"0.0 0.0 1.5707963267948966\"/g' /rosbot.urdf

# Latest version: https://github.com/foxglove/studio/pkgs/container/studio
FROM ghcr.io/foxglove/studio:latest

RUN apk update && apk add \
        bash \
        nss-tools \
        curl \
        jq \
        sed

SHELL ["/bin/bash", "-c"]

WORKDIR /src

COPY FoxgloveDefaultLayout.json /foxglove/default-layout.json

COPY Caddyfile /etc/caddy/
COPY entrypoint.sh /

# copy URDFs
COPY --from=urdf_builder /ros2_ws ./ros2_ws
COPY --from=urdf_builder /rosbot.urdf .
COPY --from=urdf_builder /rosbot_xl.urdf .
COPY --from=urdf_builder /panther.urdf .

EXPOSE 8080

ENV DS_TYPE=rosbridge-websocket
# ENV DS_TYPE=foxglove-websocket
ENV DS_PORT=9090
ENV UI_PORT=8080

# replace file:///ros2_ws with http://{{.Host}}:UI_PORT/ros2_ws in /src/rosbot_xl.urdf and /src/rosbot.urdf files
RUN sed -i 's|file:///ros2_ws|http://{{.Host}}:{{env "UI_PORT"}}/ros2_ws|g' /src/rosbot_xl.urdf /src/rosbot.urdf /src/panther.urdf

ENTRYPOINT ["/bin/sh", "/entrypoint.sh"]
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
