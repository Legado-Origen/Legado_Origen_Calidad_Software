import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';

export interface MenuOption {
  label: string;
  value: string;
  color?: string;
}
interface Props {
  options: MenuOption[];
  onSelect: (option: MenuOption) => void;
  isActive?: boolean;
}

export function Menu({ options, onSelect, isActive = true }: Props): React.ReactElement {
  const [index, setIndex] = useState(0);
  useInput(
    (_input, key) => {
      if (key.upArrow) setIndex((current) => (current - 1 + options.length) % options.length);
      else if (key.downArrow) setIndex((current) => (current + 1) % options.length);
      else if (key.return) {
        const selected = options.slice(index, index + 1)[0];
        if (selected) onSelect(selected);
      }
    },
    { isActive },
  );

  return (
    <Box flexDirection="column">
      {options.map((option, optionIndex) => (
        <Text key={option.value} color={option.color} bold={optionIndex === index}>
          {optionIndex === index ? '❯ ' : '  '}
          {option.label}
        </Text>
      ))}
    </Box>
  );
}
