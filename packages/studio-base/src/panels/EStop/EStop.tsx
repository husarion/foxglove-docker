// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Button, Palette, Typography } from "@mui/material";
import { Dispatch, SetStateAction, useCallback, useEffect, useMemo, useState } from "react";
import { makeStyles } from "tss-react/mui";

import Log from "@foxglove/log";
import { PanelExtensionContext, SettingsTreeAction } from "@foxglove/studio";
import Stack from "@foxglove/studio-base/components/Stack";
import { Config } from "@foxglove/studio-base/panels/EStop/types";
import ThemeProvider from "@foxglove/studio-base/theme/ThemeProvider";

import { defaultConfig, settingsActionReducer, useSettingsTree } from "./settings";

import "./styles.css";


const log = Log.getLogger(__dirname);

type Props = {
  context: PanelExtensionContext;
};

type EStopState = {
  waitFor: "go" | "stop";
};

type ReqState = {
  status: "requesting" | "error" | "success";
  value: string;
};

const useStyles = makeStyles<{ state?: string }>()((theme, { state }) => {
  const buttonColor = state === "go" ? "#090" : "#900";
  const augmentedButtonColor = theme.palette.augmentColor({
    color: { main: buttonColor },
  })

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
  const [eStopState, setEStopState] = useState<EStopState>({ waitFor: "go" });
  const [config, setConfig] = useState<Config>(() => ({
    ...defaultConfig,
    ...(context.initialState as Partial<Config>),
  }));
  const { classes } = useStyles({ state: eStopState.waitFor });

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
    };

    return () => {
      context.onRender = undefined;
    };
  }, [context, setColorScheme]);

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
    parsedObject != undefined &&
    requestParseError == undefined &&
    reqState?.status !== "requesting",
  );

  const eStopClicked = useCallback(async () => {
    if (!context.callService) {
      setReqState({ status: "error", value: "The data source does not allow calling services" });
      return;
    }

    const serviceName = eStopState.waitFor === "go" ? config.goServiceName : config.stopServiceName;

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
      setEStopState({ waitFor: eStopState.waitFor === "go" ? "stop" : "go" });
    } catch (err) {
      setReqState({ status: "error", value: (err as Error).message });
      log.error(err);
    }
  }, [context, eStopState.waitFor, config.goServiceName, config.stopServiceName, config.requestPayload]);

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
                {eStopState.waitFor.toUpperCase()}
              </Button>
            </span>
          </Stack>
        </div>
      </Stack>
    </Stack>
  );
}
