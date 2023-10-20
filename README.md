# foxglove-docker

Foxglove docker images customized for running directly on the robot

## Environment Variables

| Environment Variable  | Default Value         | Description                                                                      |
| --------------------- | --------------------- | -------------------------------------------------------------------------------- |
| `DS_TYPE`             | `rosbridge-websocket` | Data source type. Possible values: `rosbridge-websocket` or `foxglove-websocket` |
| `DS_PORT`             | `9090`                | Data source port                                                                 |
| `UI_PORT`             | `8080`                | User interface port                                                              |
| `DISABLE_CACHE`       | `true`                | Clear local storage in browser on page reload                                    |
| `DISABLE_INTERACTION` | `false`               | Make the UI read only                                                            |

## Quick Start

Foxglove supports information exchange both using **rosbridge** and a dedicated **foxglove bridge**. Below are instructions for running foxglove in the selected mode.

**1. Clone repository**

```bash
git clone https://github.com/husarion/foxglove-docker.git
cd foxglove-docker/demo
```

**2a. Run `foxglove_bridge` compose**

```bash
docker compose up -f compose.foxglove_bridge.yaml -d
```

**2a. Run `rosbridge` compose**

```bash
docker compose up -f compose.rosbridge.yaml -d
```

> [!NOTE]
> Foxglove recommends using `foxglove_bridge` to speed up the exchange of information.

**3. Open the Foxglove application in a browser**

To access Foxglove, input the following in your browser's search bar:

- http://<localhost>:8080/ui - if you work locally,
- http://<ROSBOT_IP>:8080/ui - if you want to connect to a device connected to the same LAN,
- http://<HUSARNET_NAME>:8080/ui - if you want to connect to the device using Husarnet VPN.

This address automatically redirects to the URL using `DS_PORT` and `DS_TYPE` envs to connect to the right data source without setting it manually in the Foxglove UI.

> [!IMPORTANT]
> If you need to modify the default-layout.json file, you must first execute the 'docker-compose down' command to remove the containers. This step is essential because the URDF files are appropriately mapped when starting the Docker container.
