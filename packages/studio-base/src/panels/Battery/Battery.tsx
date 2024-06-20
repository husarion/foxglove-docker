// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as _ from "lodash-es";
import { useCallback, useEffect, useLayoutEffect, useReducer, useState } from "react";

import { parseMessagePath, MessagePath } from "@foxglove/message-path";
import { MessageEvent, PanelExtensionContext, SettingsTreeAction } from "@foxglove/studio";
import { simpleGetMessagePathDataItems } from "@foxglove/studio-base/components/MessagePathSyntax/simpleGetMessagePathDataItems";
import Stack from "@foxglove/studio-base/components/Stack";

import { settingsActionReducer, useSettingsTree } from "./settings";
import type { Config } from "./types";

import 'remixicon/fonts/remixicon.css';
import "./styles.css";

type Props = {
  context: PanelExtensionContext;
};

const defaultConfig: Config = {
  path: "",
  minValue: 0,
  maxValue: 1,
  colorMode: "colormap",
  gradient: ["#0000ff", "#ff00ff"],
  reverse: false,
};

type State = {
  path: string;
  parsedPath: MessagePath | undefined;
  latestMessage: MessageEvent | undefined;
  latestMatchingQueriedData: unknown;
  error: Error | undefined;
  pathParseError: string | undefined;
};

type Action =
  | { type: "frame"; messages: readonly MessageEvent[] }
  | { type: "path"; path: string }
  | { type: "seek" };

function getSingleDataItem(results: unknown[]) {
  if (results.length <= 1) {
    return results[0];
  }
  throw new Error("Message path produced multiple results");
}

function reducer(state: State, action: Action): State {
  try {
    switch (action.type) {
      case "frame": {
        if (state.pathParseError != undefined) {
          return { ...state, latestMessage: _.last(action.messages), error: undefined };
        }
        let latestMatchingQueriedData = state.latestMatchingQueriedData;
        let latestMessage = state.latestMessage;
        if (state.parsedPath) {
          for (const message of action.messages) {
            if (message.topic !== state.parsedPath.topicName) {
              continue;
            }
            const data = getSingleDataItem(
              simpleGetMessagePathDataItems(message, state.parsedPath),
            );
            if (data != undefined) {
              latestMatchingQueriedData = data;
              latestMessage = message;
            }
          }
        }
        return { ...state, latestMessage, latestMatchingQueriedData, error: undefined };
      }
      case "path": {
        const newPath = parseMessagePath(action.path);
        let pathParseError: string | undefined;
        if (
          newPath?.messagePath.some(
            (part) =>
              (part.type === "filter" && typeof part.value === "object") ||
              (part.type === "slice" &&
                (typeof part.start === "object" || typeof part.end === "object")),
          ) === true
        ) {
          pathParseError = "Message paths using variables are not currently supported";
        }
        let latestMatchingQueriedData: unknown;
        let error: Error | undefined;
        try {
          latestMatchingQueriedData =
            newPath && pathParseError == undefined && state.latestMessage
              ? getSingleDataItem(simpleGetMessagePathDataItems(state.latestMessage, newPath))
              : undefined;
        } catch (err) {
          error = err;
        }
        return {
          ...state,
          path: action.path,
          parsedPath: newPath,
          latestMatchingQueriedData,
          error,
          pathParseError,
        };
      }
      case "seek":
        return {
          ...state,
          latestMessage: undefined,
          latestMatchingQueriedData: undefined,
          error: undefined,
        };
    }
  } catch (error) {
    return { ...state, latestMatchingQueriedData: undefined, error };
  }
}

export function Battery({ context }: Props): JSX.Element {
  const [renderDone, setRenderDone] = useState<() => void>(() => () => { });

  const [config, setConfig] = useState(() => ({
    ...defaultConfig,
    ...(context.initialState as Partial<Config>),
  }));

  const [state, dispatch] = useReducer(
    reducer,
    config,
    ({ path }): State => ({
      path,
      parsedPath: parseMessagePath(path),
      latestMessage: undefined,
      latestMatchingQueriedData: undefined,
      pathParseError: undefined,
      error: undefined,
    }),
  );

  useLayoutEffect(() => {
    dispatch({ type: "path", path: config.path });
  }, [config.path]);

  useEffect(() => {
    context.saveState(config);
    context.setDefaultPanelTitle(config.path === "" ? undefined : config.path);
  }, [config, context]);

  useEffect(() => {
    context.onRender = (renderState, done) => {
      setRenderDone(() => done);

      if (renderState.didSeek === true) {
        dispatch({ type: "seek" });
      }

      if (renderState.currentFrame) {
        dispatch({ type: "frame", messages: renderState.currentFrame });
      }
    };
    context.watch("currentFrame");
    context.watch("didSeek");

    return () => {
      context.onRender = undefined;
    };
  }, [context]);

  const settingsActionHandler = useCallback(
    (action: SettingsTreeAction) => {
      setConfig((prevConfig) => settingsActionReducer(prevConfig, action));
    },
    [setConfig],
  );

  const settingsTree = useSettingsTree(config, state.pathParseError, state.error?.message);
  useEffect(() => {
    context.updatePanelSettingsEditor({
      actionHandler: settingsActionHandler,
      nodes: settingsTree,
    });
  }, [context, settingsActionHandler, settingsTree]);

  useEffect(() => {
    if (state.parsedPath?.topicName != undefined) {
      context.subscribe([{ topic: state.parsedPath.topicName, preload: false }]);
    }
    return () => {
      context.unsubscribeAll();
    };
  }, [context, state.parsedPath?.topicName]);

  useEffect(() => {
    renderDone();
  }, [renderDone]);

  const rawValue =
    typeof state.latestMatchingQueriedData === "number" ||
      typeof state.latestMatchingQueriedData === "string"
      ? Number(state.latestMatchingQueriedData)
      : NaN;

  const { minValue, maxValue } = config;
  const batteryLevel = Math.round(
    (100 * (Math.min(Math.max(rawValue, minValue), maxValue) - minValue)) / (maxValue - minValue),
  );

  const updateBatteryLevel = (level: number) => {
    let levelClass = "";
    let height = `${level}%`;

    if (level <= 20) {
      levelClass = "gradient-color-red";
    } else if (level <= 50) {
      levelClass = "gradient-color-orange";
    } else if (level <= 80) {
      levelClass = "gradient-color-yellow";
    } else if (level < 100) {
      levelClass = "gradient-color-green";
    } else if (level === 100) {
      levelClass = "gradient-color-green";
      height = "110%"; /* To hide the ellipse */
    }
    return { levelClass, height };
  };

  const updateBatteryStatus = (level: number) => {
    let batteryStatus = "";
    let icon = undefined;
    if (level === 100) {
      batteryStatus = `Full battery `;
      icon = <i className="ri-battery-2-fill green-color"></i>;
    } else if (level <= 20) {
      //  && !batt.charging) {
      batteryStatus = `Low battery `;
      icon = <i className="ri-plug-line animated-red"></i>
    }
    // else if (batt.charging) {
    //   batteryStatus = `Charging... <i class="ri-flashlight-line animated-green"></i>`;
    // }
    return { batteryStatus, icon };
  };

  const { batteryStatus, icon } = updateBatteryStatus(batteryLevel);
  const { levelClass, height } = updateBatteryLevel(batteryLevel);

  return (
    <Stack justifyContent="center" alignItems="center" fullWidth fullHeight style={{ userSelect: "none" }}>
      <section className="battery">
        <div className="battery__card">
          <div className="battery__data">
            <p className="battery__text">Battery</p>
            <h1 className="battery__percentage">{batteryLevel}%</h1>
            <p className="battery__status">
              {batteryStatus}
              {icon}
            </p>
          </div>
          <div className="battery__pill">
            <div className="battery__level">
              <div className={`battery__liquid  ${levelClass} `} style={{ height }}></div>
            </div>
          </div>
        </div>
      </section>
    </Stack>
  );
}
