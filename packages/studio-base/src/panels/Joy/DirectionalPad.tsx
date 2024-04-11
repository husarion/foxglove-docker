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
  const joystickHeadRef = useRef<HTMLDivElement>(null); // Ref for the joystick head

  // Mouse down event to initiate dragging
  const handleMouseDownOnJoystick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    setStartPos({ x: event.clientX, y: event.clientY });
    if (joystickHeadRef.current) {
      joystickHeadRef.current.style.cursor = 'grabbing';
      joystickHeadRef.current.style.animation = 'none';
    }
  }, []);


  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (isDragging && startPos && joystickHeadRef.current) {
      let dx = event.clientX - startPos.x;
      let dy = event.clientY - startPos.y;

      // Calculate the distance from the center to the new position
      const distance = Math.sqrt(dx * dx + dy * dy);
      const maxDistance = 130; // Assuming the joystick can move 75px in any direction from the center

      // If the distance is more than allowed, clamp it to the circular boundary
      if (distance > maxDistance) {
        dx *= maxDistance / distance;
        dy *= maxDistance / distance;
      }

      const v_x = Math.round(-dy)/maxDistance;
      const v_y = Math.round(-dx)/maxDistance;

      setSpeed({x: v_x, y: v_y});
      if(!disabled)
      {
        onSpeedChange?.({x: v_x, y: v_y});
      }

      joystickHeadRef.current.style.transform = `translate(${dx}px, ${dy}px)`;
    }
  }, [isDragging, startPos, onSpeedChange, disabled]);

  // Mouse up event to end dragging
  const handleMouseUp = useCallback(() => {
    if (speed != undefined || isDragging) {
      setIsDragging(false);
      setSpeed(undefined);
      props.onSpeedChange?.({x: 0, y: 0});
      if (joystickHeadRef.current) {
        joystickHeadRef.current.style.cursor = '';
        joystickHeadRef.current.style.transform = '';
        // joystickHeadRef.current.style.animation = 'glow';
      }
    }
  }, [isDragging, speed, props]);

  // UseEffect hook to add and remove the global event listeners
  React.useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <Stack justifyContent="center" alignItems="center" fullWidth fullHeight>
      <div id="center">
        <div id="game">
          <div id="joystick">
            <div className="joystick-arrow"></div>
            <div className="joystick-arrow"></div>
            <div className="joystick-arrow"></div>
            <div className="joystick-arrow"></div>
            <div id="joystick-head" ref={joystickHeadRef} onMouseDown={handleMouseDownOnJoystick}></div>
          </div>
          {/* Note below joystick for action feedback */}
          <div id="note">
            X: {speed?.x.toFixed(2) ?? '0.00'} Y: {speed?.y.toFixed(2) ?? '0.00'}
          </div>
        </div>
      </div>
    </Stack>
  );
}

export default DirectionalPad;
