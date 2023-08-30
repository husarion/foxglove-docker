ARG FOXGLOVE_VERSION=v1.39.1

# URDF stage
FROM husarion/rviz2:humble-nightly as urdf_builder

RUN apt-get update && apt-get install -y \
        python3-pip \
        python3-colcon-common-extensions \
        python3-rosdep \
        python3-vcstool \
        git && \
    git clone -b ros2-control https://github.com/husarion/panther_ros.git /ros2_ws/src/panther_ros && \
    rm -rf /ros2_ws/src/panther && \
    rm -rf /ros2_ws/src/panther_battery && \
    rm -rf /ros2_ws/src/panther_controller && \
    rm -rf /ros2_ws/src/panther_hardware_interfaces && \
    rm -rf /ros2_ws/src/panther_utils && \
    cd /ros2_ws && \
    colcon build

RUN apt-get update -y && apt-get install -y ros-$ROS_DISTRO-xacro && \
    source install/setup.bash && \
    xacro /ros2_ws/src/rosbot_ros/rosbot_description/urdf/rosbot.urdf.xacro > /rosbot.urdf && \
    xacro /ros2_ws/src/rosbot_xl_ros/rosbot_xl_description/urdf/rosbot_xl.urdf.xacro > /rosbot_xl.urdf && \
    xacro /ros2_ws/src/panther_ros/panther_description/urdf/panther.urdf.xacro > /panther.urdf && \
    # Changing rotation is cause by .stl files in rosbot_ros/rosbot_description. We will change it to the .dae files.
    sed -i 's/rpy=\"1.5707963267948966 0.0 1.5707963267948966\"/rpy=\"0.0 0.0 1.5707963267948966\"/g' /rosbot.urdf

# Build stage
FROM node:16 as build

ARG FOXGLOVE_VERSION

RUN apt update && apt install -y \
        git-lfs

WORKDIR /src
RUN git clone --branch $FOXGLOVE_VERSION https://github.com/foxglove/studio
WORKDIR /src/studio

COPY studio-files/defaultLayout.ts ./packages/studio-base/src/providers/CurrentLayoutProvider/defaultLayout.ts
COPY studio-files/Start.tsx ./packages/studio-base/src/components/OpenDialog/Start.tsx
COPY studio-files/Root.tsx ./web/src/Root.tsx
COPY studio-files/RosbridgeDataSourceFactory.ts ./packages/studio-base/src/dataSources/RosbridgeDataSourceFactory.ts
RUN grep -rl 'showOpenDialogOnStartup = true' ./packages/studio-base/src/Workspace.tsx \
    | xargs sed -i 's/showOpenDialogOnStartup = true/showOpenDialogOnStartup = false/g'

RUN corepack enable
RUN yarn install --immutable

ENV FOXGLOVE_DISABLE_SIGN_IN=true
RUN yarn run web:build:prod

# Release stage
FROM caddy:2.6.2-alpine

ARG FOXGLOVE_VERSION

RUN apk update && apk add bash

SHELL ["/bin/bash", "-c"]

WORKDIR /src

COPY --from=build /src/studio/web/.webpack .
COPY FoxgloveDefaultLayout.json .
COPY default-url.txt .

COPY Caddyfile /etc/caddy/
COPY caddy_entrypoint.sh /

# copy URDFs
COPY --from=urdf_builder /ros2_ws ./ros2_ws
COPY --from=urdf_builder /rosbot.urdf .
COPY --from=urdf_builder /rosbot_xl.urdf .
COPY --from=urdf_builder /panther.urdf .

# replace file:///ros2_ws with http://{{.Host}}:FOXGLOVE_PORT/ros2_ws in /src/rosbot_xl.urdf and /src/rosbot.urdf files
RUN sed -i 's|file:///ros2_ws|http://{{.Host}}:{{env "FOXGLOVE_PORT"}}/ros2_ws|g' /src/rosbot_xl.urdf /src/rosbot.urdf /src/panther.urdf

# replace localhost:8080 with {{.Host}}:FOXGLOVE_PORT in /src/FoxgloveDefaultLayout.json file
RUN sed -i 's|localhost:8080|{{.Host}}:{{env "FOXGLOVE_PORT"}}|g' /src/FoxgloveDefaultLayout.json

EXPOSE 8080
# CMD ["caddy", "file-server", "--listen", ":8080"]

RUN echo $(echo $FOXGLOVE_VERSION | sed -r 's/v([0-9]+.[0-9]+.[0-9]+)/\1/g') > /version.txt

ENV FOXGLOVE_PORT=8080
ENV ROSBRIDGE_PORT=9090

# ENTRYPOINT [ "/bin/bash", "/caddy_entrypoint.sh" ]
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
