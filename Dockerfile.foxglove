ARG FOXGLOVE_VERSION=v1.39.1

# URDF stage
FROM husarion/rviz2:humble-nightly as urdf_builder
RUN apt-get update -y && apt-get install -y ros-$ROS_DISTRO-xacro && \
    source install/setup.bash && \
    xacro /ros2_ws/src/rosbot_ros/rosbot_description/urdf/rosbot.urdf.xacro > /rosbot.urdf && \
    sed -i 's/file:/http:/g' /rosbot.urdf && \
    sed -i 's/\/ros2_ws/localhost:8080\/ros2_ws/g' /rosbot.urdf && \
    xacro /ros2_ws/src/rosbot_xl_ros/rosbot_xl_description/urdf/rosbot_xl.urdf.xacro > /rosbot_xl.urdf && \
    sed -i 's/file:/http:/g' /rosbot_xl.urdf && \
    sed -i 's/\/ros2_ws/localhost:8080\/ros2_ws/g' /rosbot_xl.urdf && \
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

COPY defaultLayout.ts ./packages/studio-base/src/providers/CurrentLayoutProvider/defaultLayout.ts
COPY Start.tsx ./packages/studio-base/src/components/OpenDialog/Start.tsx
RUN grep -rl 'showOpenDialogOnStartup = true' ./packages/studio-base/src/Workspace.tsx \
    | xargs sed -i 's/showOpenDialogOnStartup = true/showOpenDialogOnStartup = false/g'

RUN corepack enable
RUN yarn install --immutable

ENV FOXGLOVE_DISABLE_SIGN_IN=true
RUN yarn run web:build:prod

# Release stage
FROM caddy:2.5.2-alpine

ARG FOXGLOVE_VERSION

WORKDIR /src
COPY --from=build /src/studio/web/.webpack ./
COPY ./Default.json ./
COPY ./RosbotTeleop.json ./

COPY Caddyfile /etc/caddy/Caddyfile

# copy URDFs
COPY --from=husarion/rviz2:humble-nightly /ros2_ws /src/ros2_ws
COPY --from=urdf_builder /rosbot.urdf /src/rosbot.urdf
COPY --from=urdf_builder /rosbot_xl.urdf /src/rosbot_xl.urdf

EXPOSE 8080
# CMD ["caddy", "file-server", "--listen", ":8080"]

RUN echo $(echo $FOXGLOVE_VERSION | sed -r 's/v([0-9]+.[0-9]+.[0-9]+)/\1/g') > /version.txt

# disable cache
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
