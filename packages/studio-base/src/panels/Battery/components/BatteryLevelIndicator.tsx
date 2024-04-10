import React from 'react';

interface BatteryLevelIndicatorProps {
  level: number;
}

const BatteryLevelIndicator: React.FC<BatteryLevelIndicatorProps> = ({ level }) => {
  const batteryContainerStyle: React.CSSProperties = {
    // width: '100%',
    border: '1px solid gray',
    borderRadius: '5px',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3a3a3e',
    padding: "0.1rem",
    minWidth: '3.5rem', // set the minimum width to the width of the text element plus padding
    maxHeight: "3rem"
  };

  const batteryLevelStyle: React.CSSProperties = {
    width: `${level}%`,
    // Map battery color ranging from not too bright green to red passing by yellowish
    backgroundColor: `rgb(${255 - 2.55 * level}, ${2.55 * level * 0.8}, 0)`,
    borderRadius: '2.5px',
    // Apply a smooth animation effect when the width changes
    transition: 'all 0.5s ease',
    alignItems: 'left',
    justifyContent: 'center',
    // maxHeight: "100%",
  };

  const batteryTextStyle: React.CSSProperties = {
    fontSize: '1rem',
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    verticalAlign: "center",
    padding: "0.5rem",
  };

  return (
    <div style={batteryContainerStyle}>
      <div style={batteryLevelStyle}>
        <div style={batteryTextStyle}>{Math.floor(level)}%</div>
      </div>
    </div>
  );
};

export default BatteryLevelIndicator;
