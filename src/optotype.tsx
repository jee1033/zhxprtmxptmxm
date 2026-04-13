import { Direction } from './types';

interface Props {
  sizePx: number;
  direction: Direction;
}

const rotation: Record<Direction, number> = {
  up: 270,
  right: 0,
  down: 90,
  left: 180,
};

export function TumblingE({ sizePx, direction }: Props) {
  const stroke = 1;
  const bar = 5;
  const path = [
    `M 0 0 H ${bar} V ${stroke} H ${stroke} V ${2 * stroke} H ${4 * stroke} V ${3 * stroke} H ${stroke} V ${4 * stroke} H ${bar} V ${bar} H 0 Z`,
  ].join(' ');

  return (
    <svg width={sizePx} height={sizePx} viewBox="0 0 5 5" aria-label={`E-${direction}`}>
      <g transform={`rotate(${rotation[direction]} 2.5 2.5)`}>
        <path d={path} fill="#111" />
      </g>
    </svg>
  );
}
