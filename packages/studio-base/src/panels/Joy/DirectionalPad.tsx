// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import React, { useCallback, useState, useRef } from "react";

import Stack from "@foxglove/studio-base/components/Stack";
import "./styles.css";

// Type for the Joystick Props
type DirectionalPadProps = {
  disabled?: boolean;
  onSpeedChange?: (pos: { x: number; y: number }) => void;
};

// Component for the DirectionalPad
function DirectionalPad(props: DirectionalPadProps): JSX.Element {
  const { onSpeedChange, disabled = false } = props;
  const [speed, setSpeed] = useState<{ x: number; y: number } | undefined>();
  const [startPos, setStartPos] = useState<{ x: number; y: number } | undefined>();
  const [isDragging, setIsDragging] = useState(false);
  const joystickHeadRef = useRef<HTMLDivElement>(null);

  const startDrag = useCallback((x: number, y: number) => {
    setIsDragging(true);
    setStartPos({ x, y });
    if (joystickHeadRef.current) {
      joystickHeadRef.current.style.cursor = "grabbing";
      joystickHeadRef.current.style.animation = "none";
    }
  }, []);

  // Handler for mouse down and touch start events
  const handleStart = useCallback(
    (event: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
      const clientX =
        event.type === "touchstart"
          ? (event as React.TouchEvent<HTMLDivElement>).touches[0]!.clientX
          : (event as React.MouseEvent<HTMLDivElement>).clientX;
      const clientY =
        event.type === "touchstart"
          ? (event as React.TouchEvent<HTMLDivElement>).touches[0]!.clientY
          : (event as React.MouseEvent<HTMLDivElement>).clientY;
      startDrag(clientX, clientY);
    },
    [startDrag],
  );

  const moveJoystick = useCallback(
    (clientX: number, clientY: number) => {
      if (isDragging && startPos && joystickHeadRef.current) {
        let dx = clientX - startPos.x;
        let dy = clientY - startPos.y;

        const distance = Math.sqrt(dx * dx + dy * dy);
        const maxDistance = 130;

        if (distance > maxDistance) {
          dx *= maxDistance / distance;
          dy *= maxDistance / distance;
        }

        const v_x = Math.round(-dy) / maxDistance;
        const v_y = Math.round(-dx) / maxDistance;

        setSpeed({ x: v_x, y: v_y });
        if (!disabled) {
          onSpeedChange?.({ x: v_x, y: v_y });
        }

        joystickHeadRef.current.style.transform = `translate(${dx}px, ${dy}px)`;
      }
    },
    [isDragging, startPos, onSpeedChange, disabled],
  );

  const handleMove = useCallback(
    (event: MouseEvent | TouchEvent) => {
      const clientX = "touches" in event ? event.touches[0]!.clientX : event.clientX;
      const clientY = "touches" in event ? event.touches[0]!.clientY : event.clientY;

      moveJoystick(clientX, clientY);
    },
    [moveJoystick],
  );

  // Mouse up and touch end event to end dragging
  const handleEnd = useCallback(() => {
    if (speed != undefined || isDragging) {
      setIsDragging(false);
      setSpeed(undefined);
      onSpeedChange?.({ x: 0, y: 0 });
      if (joystickHeadRef.current) {
        joystickHeadRef.current.style.cursor = "";
        joystickHeadRef.current.style.transform = "";
      }
    }
  }, [isDragging, speed, onSpeedChange]);

  React.useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleEnd);
      window.addEventListener("touchmove", handleMove);
      window.addEventListener("touchend", handleEnd);
    }

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleEnd);
    };
  }, [isDragging, handleMove, handleEnd]);

  return (
    <Stack justifyContent="center" alignItems="center" fullWidth fullHeight>
      <div id="center">
        <div id="game">
          <div id="joystick">
            <div className="joystick-arrow"></div>
            <div className="joystick-arrow"></div>
            <div className="joystick-arrow"></div>
            <div className="joystick-arrow"></div>
            <div
              id="joystick-head"
              ref={joystickHeadRef}
              onMouseDown={handleStart}
              onTouchStart={handleStart}
            ></div>
          </div>
          <div id="note">
            X: {speed?.x.toFixed(2) ?? "0.00"} Y: {speed?.y.toFixed(2) ?? "0.00"}
          </div>
        </div>
      </div>
    </Stack>
  );
}

export default DirectionalPad;
