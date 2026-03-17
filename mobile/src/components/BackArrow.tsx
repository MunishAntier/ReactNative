import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface Props {
    color?: string;
    size?: number;
}

const BackArrow: React.FC<Props> = ({ color = '#FFFFFF', size = 20 }) => {
    return (
        <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
            <Path 
                d="M15.8332 10H4.1665" 
                stroke={color} 
                strokeWidth="1.5" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
            />
            <Path 
                d="M9.99984 15.8333L4.1665 10L9.99984 4.16663" 
                stroke={color} 
                strokeWidth="1.5" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
            />
        </Svg>
    );
};

export default BackArrow;
