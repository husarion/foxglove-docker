// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as _ from "lodash-es";
import { useCallback, useEffect, useLayoutEffect, useReducer, useState } from "react";
// import { v4 as uuidv4 } from "uuid";

import { parseMessagePath, MessagePath } from "@foxglove/message-path";
import { MessageEvent, PanelExtensionContext, SettingsTreeAction } from "@foxglove/studio";
import { simpleGetMessagePathDataItems } from "@foxglove/studio-base/components/MessagePathSyntax/simpleGetMessagePathDataItems";
// import { turboColorString } from "@foxglove/studio-base/util/colorUtils";
import Stack from "@foxglove/studio-base/components/Stack";

import { settingsActionReducer, useSettingsTree } from "./settings";
import type { Config } from "./types";

import "./styles.css";

class MovingAverage {
  #windowSize: number;
  #values: number[];
  #sum: number;

  public constructor(windowSize: number) {
    this.#windowSize = windowSize;
    this.#values = [];
    this.#sum = 0;
  }

  public addValue(value: number) {
    this.#values.push(value);
    this.#sum += value;
    if (this.#values.length > this.#windowSize) {
      this.#sum -= this.#values.shift() ?? 0;
    }
  }

  public getMean() {
    return this.#values.length === 0 ? 0 : this.#sum / this.#values.length;
  }
}

type Props = {
  context: PanelExtensionContext;
};

const defaultConfig: Config = {
  path: "",
  maxValue: 1,
  // windowSize: 100,
  reverse: false,
};

type State = {
  path: string;
  parsedPath: MessagePath | undefined;
  latestMessage: MessageEvent | undefined;
  latestMatchingQueriedData: unknown;
  movingAverage: MovingAverage;
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
              if (typeof data === "number") {
                state.movingAverage.addValue(data);
              }
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
          movingAverage: new MovingAverage(100),
          error,
          pathParseError,
        };
      }
      case "seek":
        return {
          ...state,
          latestMessage: undefined,
          latestMatchingQueriedData: undefined,
          movingAverage: new MovingAverage(100),
          error: undefined,
        };
    }
  } catch (error) {
    return { ...state, latestMatchingQueriedData: undefined, error };
  }
}

export function Bar({ context }: Props): JSX.Element {
  // panel extensions must notify when they've completed rendering
  // onRender will setRenderDone to a done callback which we can invoke after we've rendered
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
      movingAverage: new MovingAverage(100),
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

  // Indicate render is complete - the effect runs after the dom is updated
  useEffect(() => {
    renderDone();
  }, [renderDone]);

  const latestMovingAverage = state.movingAverage.getMean();
  const rawValue = typeof latestMovingAverage === "number" ? latestMovingAverage : NaN;

  const { maxValue, reverse } = config;
  const barPercentage = Math.round((100 * rawValue) / maxValue);
  const percentage = reverse ? -barPercentage : barPercentage;

  const levelHeight = Math.max(Math.min(Math.abs(barPercentage), 100), 0) / 2;  // 50% is the max height
  const isPositive = reverse ? rawValue < 0 : rawValue >= 0;
  const top = isPositive ? `${50 - levelHeight}%` : "50%";
  const bottom = isPositive ? "50%" : `${50 - levelHeight}%`;

  return (
    <Stack
      justifyContent="center"
      alignItems="center"
      fullWidth
      fullHeight
      style={{ userSelect: "none" }}
    >
      <div className="bar">
        <div
          className={`level ${isPositive ? "positive" : "negative"}`}
          style={{ height: `${levelHeight}%`, top, bottom }}
        ></div>
      </div>
      <div className="percentage">{percentage}%</div>
    </Stack>
  );
}
