// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as _ from "lodash-es";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { DeepPartial } from "ts-essentials";

import { ros1 } from "@foxglove/rosmsg-msgs-common";
import {
  PanelExtensionContext,
  SettingsTreeAction,
  SettingsTreeNode,
  SettingsTreeNodes,
  Topic,
} from "@foxglove/studio";
import EmptyState from "@foxglove/studio-base/components/EmptyState";
import ThemeProvider from "@foxglove/studio-base/theme/ThemeProvider";

import DirectionalPad from "./DirectionalPad";

type JoyProps = {
  context: PanelExtensionContext;
};

const geometryMsgOptions = [
  { label: "linear-x", value: "linear-x" },
  { label: "linear-y", value: "linear-y" },
  { label: "linear-z", value: "linear-z" },
  { label: "angular-x", value: "angular-x" },
  { label: "angular-y", value: "angular-y" },
  { label: "angular-z", value: "angular-z" },
];

type Axis = { field: string; limit: number };

type Config = {
  topic: undefined | string;
  publishRate: number;
  xAxis: Axis;
  yAxis: Axis;
};

function buildSettingsTree(config: Config, topics: readonly Topic[]): SettingsTreeNodes {
  const general: SettingsTreeNode = {
    label: "General",
    fields: {
      publishRate: { label: "Publish rate", input: "number", value: config.publishRate },
      topic: {
        label: "Topic",
        input: "autocomplete",
        value: config.topic,
        items: topics.map((t) => t.name),
      },
    },
    children: {
      xAxis: {
        label: "X Axis",
        fields: {
          field: {
            label: "Field",
            input: "select",
            value: config.xAxis.field,
            options: geometryMsgOptions,
          },
          limit: {
            label: "Limit",
            input: "number",
            value: config.xAxis.limit,
            step: 0.25,
            min: 0,
            max: 10,
          },
        },
      },
      yAxis: {
        label: "Y Axis",
        fields: {
          field: {
            label: "Field",
            input: "select",
            value: config.yAxis.field,
            options: geometryMsgOptions,
          },
          limit: {
            label: "Limit",
            input: "number",
            value: config.yAxis.limit,
            step: 0.25,
            min: 0,
            max: 10,
          },
        },
      },
    },
  };

  return { general };
}

function Joy(props: JoyProps): JSX.Element {
  const { context } = props;
  const { saveState } = context;

  const [speed, setVelocity] = useState<{ x: number; y: number } | undefined>();
  const [topics, setTopics] = useState<readonly Topic[]>([]);

  // resolve an initial config which may have some missing fields into a full config
  const [config, setConfig] = useState<Config>(() => {
    const partialConfig = context.initialState as DeepPartial<Config>;

    const {
      topic,
      publishRate = 5,
      xAxis: { field: xAxisField = "linear-x", limit: xLimit = 1 } = {},
      yAxis: { field: yAxisField = "angular-z", limit: yLimit = 1 } = {},
    } = partialConfig;

    return {
      topic,
      publishRate,
      xAxis: { field: xAxisField, limit: xLimit },
      yAxis: { field: yAxisField, limit: yLimit },
    };
  });

  const settingsActionHandler = useCallback((action: SettingsTreeAction) => {
    if (action.action !== "update") {
      return;
    }

    setConfig((previous) => {
      const newConfig = { ...previous };
      _.set(newConfig, action.payload.path.slice(1), action.payload.value);
      return newConfig;
    });
  }, []);

  // setup context render handler and render done handling
  const [renderDone, setRenderDone] = useState<() => void>(() => () => { });
  const [colorScheme, setColorScheme] = useState<"dark" | "light">("light");
  useLayoutEffect(() => {
    context.watch("topics");
    context.watch("colorScheme");

    context.onRender = (renderState, done) => {
      setTopics(renderState.topics ?? []);
      setRenderDone(() => done);
      if (renderState.colorScheme) {
        setColorScheme(renderState.colorScheme);
      }
    };
  }, [context]);

  useEffect(() => {
    const tree = buildSettingsTree(config, topics);
    context.updatePanelSettingsEditor({
      actionHandler: settingsActionHandler,
      nodes: tree,
    });
    saveState(config);
  }, [config, context, saveState, settingsActionHandler, topics]);

  // advertise topic
  const { topic: currentTopic } = config;
  useLayoutEffect(() => {
    if (!currentTopic) {
      return;
    }

    context.advertise?.(currentTopic, "geometry_msgs/Twist", {
      datatypes: new Map([
        ["geometry_msgs/Vector3", ros1["geometry_msgs/Vector3"]],
        ["geometry_msgs/Twist", ros1["geometry_msgs/Twist"]],
      ]),
    });

    return () => {
      context.unadvertise?.(currentTopic);
    };
  }, [context, currentTopic]);

  useLayoutEffect(() => {
    if (speed == undefined || !currentTopic) {
      return;
    }

    const message = {
      linear: { x: 0, y: 0, z: 0 },
      angular: { x: 0, y: 0, z: 0 },
    };

    function setTwistValue(axis: Axis, value: number) {
      switch (axis.field) {
        case "linear-x":
          message.linear.x = value;
          break;
        case "linear-y":
          message.linear.y = value;
          break;
        case "linear-z":
          message.linear.z = value;
          break;
        case "angular-x":
          message.angular.x = value;
          break;
        case "angular-y":
          message.angular.y = value;
          break;
        case "angular-z":
          message.angular.z = value;
          break;
      }
    }

    setTwistValue(config.xAxis, speed.x);
    setTwistValue(config.yAxis, speed.y);

    // don't publish if rate is 0 or negative - this is a config error on user's part
    if (config.publishRate <= 0) {
      return;
    }

    const intervalMs = (1000 * 1) / config.publishRate;
    context.publish?.(currentTopic, message);
    const intervalHandle = setInterval(() => {
      context.publish?.(currentTopic, message);
    }, intervalMs);

    return () => {
      clearInterval(intervalHandle);
    };
  }, [context, config, currentTopic, speed]);

  useLayoutEffect(() => {
    renderDone();
  }, [renderDone]);

  const canPublish = context.publish != undefined && config.publishRate > 0;
  const hasTopic = Boolean(currentTopic);
  const enabled = canPublish && hasTopic;

  return (
    <ThemeProvider isDark={colorScheme === "dark"}>
      {!canPublish && <EmptyState>Connect to a data source that supports publishing</EmptyState>}
      {canPublish && !hasTopic && (
        <EmptyState>Select a publish topic in the panel settings</EmptyState>
      )}
      {enabled && (
        <DirectionalPad
          disabled={!enabled}
          onSpeedChange={(value) => {
            setVelocity(value);
          }}
          xLimit={config.xAxis.limit}
          yLimit={config.yAxis.limit}
        />
      )}
    </ThemeProvider>
  );
}

export default Joy;
