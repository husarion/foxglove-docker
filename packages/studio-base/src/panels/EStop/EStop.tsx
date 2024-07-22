// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Button, Palette, Typography } from "@mui/material";
import * as _ from "lodash-es";
import { Dispatch, SetStateAction, useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useState } from "react";
import { makeStyles } from "tss-react/mui";

import Log from "@foxglove/log";
import { parseMessagePath, MessagePath } from "@foxglove/message-path";
import { MessageEvent, PanelExtensionContext, SettingsTreeAction } from "@foxglove/studio";
import { simpleGetMessagePathDataItems } from "@foxglove/studio-base/components/MessagePathSyntax/simpleGetMessagePathDataItems";
import Stack from "@foxglove/studio-base/components/Stack";
import { Config } from "@foxglove/studio-base/panels/EStop/types";
import ThemeProvider from "@foxglove/studio-base/theme/ThemeProvider";

import { defaultConfig, settingsActionReducer, useSettingsTree } from "./settings";

import "./styles.css";


const log = Log.getLogger(__dirname);

type Props = {
  context: PanelExtensionContext;
};

type EStopState = "go" | "stop" | undefined;

type ReqState = {
  status: "requesting" | "error" | "success";
  value: string;
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

const useStyles = makeStyles<{ state?: string }>()((theme, { state }) => {
  const buttonColor = state === "go" ? "#090" : "#900";
  const augmentedButtonColor = theme.palette.augmentColor({
    color: { main: buttonColor },
  });

  return {
    button: {
      backgroundColor: augmentedButtonColor.main,
      color: augmentedButtonColor.contrastText,

      "&:hover": {
        backgroundColor: augmentedButtonColor.dark,
      },
    },
  };
});

function parseInput(value: string): { error?: string; parsedObject?: unknown } {
  let parsedObject;
  let error = undefined;
  try {
    const parsedAny: unknown = JSON.parse(value);
    if (Array.isArray(parsedAny)) {
      error = "Request content must be an object, not an array";
    } else if (parsedAny == undefined) {
      error = "Request content must be an object, not null";
    } else if (typeof parsedAny !== "object") {
      error = `Request content must be an object, not ‘${typeof parsedAny}’`;
    } else {
      parsedObject = parsedAny;
    }
  } catch (e) {
    error = value.length !== 0 ? e.message : "Enter valid request content as JSON";
  }
  return { error, parsedObject };
}

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

// Wrapper component with ThemeProvider so useStyles in the panel receives the right theme.
export function EStop({ context }: Props): JSX.Element {
  const [colorScheme, setColorScheme] = useState<Palette["mode"]>("light");

  return (
    <ThemeProvider isDark={colorScheme === "dark"}>
      <EStopContent context={context} setColorScheme={setColorScheme} />
    </ThemeProvider>
  );
}

function EStopContent(
  props: Props & { setColorScheme: Dispatch<SetStateAction<Palette["mode"]>> },
): JSX.Element {
  const { context, setColorScheme } = props;

  // panel extensions must notify when they've completed rendering
  // onRender will setRenderDone to a done callback which we can invoke after we've rendered
  const [renderDone, setRenderDone] = useState<() => void>(() => () => { });
  const [reqState, setReqState] = useState<ReqState | undefined>();
  const [eStopAction, setEStopAction] = useState<EStopState>();
  const [config, setConfig] = useState<Config>(() => ({
    ...defaultConfig,
    ...(context.initialState as Partial<Config>),
  }));
  const { classes } = useStyles({ state: eStopAction });

  const [state, dispatch] = useReducer(
    reducer,
    { ...config, path: config.statusTopicName },
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
    dispatch({ type: "path", path: config.statusTopicName });
  }, [config.statusTopicName]);

  useEffect(() => {
    context.saveState(config);
    context.setDefaultPanelTitle(
      config.goServiceName ? `Unspecified` : undefined,
    );
  }, [config, context]);

  useEffect(() => {
    context.saveState(config);
    context.setDefaultPanelTitle(
      config.stopServiceName ? `Unspecified` : undefined,
    );
  }, [config, context]);

  useEffect(() => {
    context.watch("colorScheme");

    context.onRender = (renderReqState, done) => {
      setRenderDone(() => done);
      setColorScheme(renderReqState.colorScheme ?? "light");

      if (renderReqState.didSeek === true) {
        dispatch({ type: "seek" });
      }

      if (renderReqState.currentFrame) {
        dispatch({ type: "frame", messages: renderReqState.currentFrame });
      }
    };

    context.watch("currentFrame");
    context.watch("didSeek");

    return () => {
      context.onRender = undefined;
    };
  }, [context, setColorScheme]);

  useEffect(() => {
    if (state.parsedPath?.topicName != undefined) {
      context.subscribe([{ topic: state.parsedPath.topicName, preload: false }]);
    }
    return () => {
      context.unsubscribeAll();
    };
  }, [context, state.parsedPath?.topicName]);

  const { error: requestParseError, parsedObject } = useMemo(
    () => parseInput(config.requestPayload ?? ""),
    [config.requestPayload],
  );

  const settingsActionHandler = useCallback(
    (action: SettingsTreeAction) => {
      setConfig((prevConfig) => settingsActionReducer(prevConfig, action));
    },
    [setConfig],
  );

  const settingsTree = useSettingsTree(config);
  useEffect(() => {
    context.updatePanelSettingsEditor({
      actionHandler: settingsActionHandler,
      nodes: settingsTree,
    });
  }, [context, settingsActionHandler, settingsTree]);

  const statusMessage = useMemo(() => {
    if (context.callService == undefined) {
      return "Connect to a data source that supports calling services";
    }
    if (!config.goServiceName || !config.stopServiceName) {
      return "Configure a service in the panel settings";
    }
    return undefined;
  }, [context, config.goServiceName, config.stopServiceName]);

  const canEStop = Boolean(
    context.callService != undefined &&
    config.requestPayload &&
    config.goServiceName &&
    config.stopServiceName &&
    eStopAction != undefined &&
    parsedObject != undefined &&
    requestParseError == undefined &&
    reqState?.status !== "requesting",
  );

  const eStopClicked = useCallback(async () => {
    if (!context.callService) {
      setReqState({ status: "error", value: "The data source does not allow calling services" });
      return;
    }

    const serviceName = eStopAction === "go" ? config.goServiceName : config.stopServiceName;

    if (!serviceName) {
      setReqState({ status: "error", value: "Service name is not configured" });
      return;
    }

    try {
      setReqState({ status: "requesting", value: `Calling ${serviceName}...` });
      const response = await context.callService(serviceName, JSON.parse(config.requestPayload!));
      setReqState({
        status: "success",
        value: JSON.stringify(response, (_key, value) => (typeof value === "bigint" ? value.toString() : value), 2) ?? "",
      });
      setEStopAction(undefined);
    } catch (err) {
      setReqState({ status: "error", value: (err as Error).message });
      log.error(err);
    }
  }, [context, eStopAction, config.goServiceName, config.stopServiceName, config.requestPayload]);

  // Setting eStopAction based on state.latestMatchingQueriedData
  useEffect(() => {
    if (state.latestMatchingQueriedData != undefined) {
      const data = state.latestMatchingQueriedData as boolean;
      setEStopAction(data ? "go" : "stop");
    }
  }, [state.latestMatchingQueriedData]);

  // Indicate render is complete - the effect runs after the dom is updated
  useEffect(() => {
    renderDone();
  }, [renderDone]);

  return (
    <Stack flex="auto" gap={1} padding={1.5} position="relative" fullHeight>
      <Stack justifyContent="center" alignItems="center" fullWidth fullHeight>
        <div className="center">
          <Stack
            direction="column-reverse"
            justifyContent="center"
            alignItems="center"
            overflow="hidden"
            flexGrow={0}
            gap={1.5}
          >
            {statusMessage && (
              <Typography variant="caption" noWrap>
                {statusMessage}
              </Typography>
            )}
            <span>
              <Button
                className={classes.button}
                variant="contained"
                disabled={!canEStop}
                onClick={eStopClicked}
                data-testid="call-service-button"
                style={{
                  minWidth: "150px",
                  minHeight: "70px",
                  fontSize: "1.7rem",
                  borderRadius: "0.3rem",
                }}
              >
                {eStopAction?.toUpperCase() ?? "Wait for feedback"}
              </Button>
            </span>
          </Stack>
        </div>
      </Stack>
    </Stack>
  );
}
