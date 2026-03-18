import React from 'react';
import Svg, { Path, SvgProps } from 'react-native-svg';

interface Props extends SvgProps {
    color?: string;
}

const BlueArrowIcon: React.FC<Props> = ({ color = '#0230F9', ...props }) => (
    <Svg width={20.17} height={14.67} viewBox="0 0 21 15" fill="none" {...props}>
        <Path
            d="M1 7.33333H19.5M19.5 7.33333L13.5 1.33333M19.5 7.33333L13.5 13.3333"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </Svg>
);

export default BlueArrowIcon;
