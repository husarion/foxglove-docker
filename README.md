# foxglove-docker

Foxglove docker images customized for running directly on the robot

## Environment Variables

| Environment Variable | Default Value | Description |
| - | - | - |
| `DS_TYPE` | `rosbridge-websocket` | Data source type. Possible values: `rosbridge-websocket` or  `foxglove-websocket` |
| `DS_PORT` | `9090` | Data source port |
| `UI_PORT` | `8080` | User interface port |

## Quick Start

Create the `compose.yaml` file

```yaml
services:
  foxglove:
    image: husarion/foxglove:1.72.0
    ports:
      - 8080:8080
    # optionaly override the default config
    # volumes:
    #   - ./custom-ui-config.json:/foxglove/default-layout.json
    environment:
      - DS_TYPE=rosbridge-websocket
      - DS_PORT=9090
      - UI_PORT=8080

  rosbridge:
    image: husarion/rosbridge-server:humble
    ports:
      - 9090:9090
    command: ros2 launch rosbridge_server rosbridge_websocket_launch.xml
```

And execute in the terminal:

```bash
docker compose up -d
```

> **IMPORTANT:**
>
> If you want to change `default-layout.json` it is necessary to execute the `docker compose down` command which removes the containers. This is because urdf files are mapped appropriately when starting the Docker container.

http://localhost:8080/ui

This address automatically redirects to the URL using `DS_PORT` and `DS_TYPE` envs to connect to the right data source without setting it manually in the Foxglove UI.


