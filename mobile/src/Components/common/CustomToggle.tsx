import React, { useEffect, useRef } from 'react';
import { TouchableOpacity, Animated, StyleSheet } from 'react-native';

interface Props {
    value: boolean;
    onValueChange: (value: boolean) => void;
    disabled?: boolean;
}

const CustomToggle: React.FC<Props> = ({ value, onValueChange, disabled = false }) => {
    const animatedValue = useRef(new Animated.Value(value ? 1 : 0)).current;

    useEffect(() => {
        Animated.timing(animatedValue, {
            toValue: value ? 1 : 0,
            duration: 200,
            useNativeDriver: false,
        }).start();
    }, [value]);

    const translateX = animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [3.2, 16], // paddingLefr: 3.2, active position: 32 - 12.8 - 3.2 = 16
    });

    const backgroundColor = animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: ['#B5B5B5', '#0230F9'],
    });

    const thumbColor = animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: ['#606060', '#FCFDFD'],
    });

    return (
        <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => onValueChange(!value)}
            disabled={disabled}
        >
            <Animated.View 
                style={[styles.container, { backgroundColor }]}
                pointerEvents={disabled ? 'none' : 'auto'}
            >
                <Animated.View
                    style={[
                        styles.thumb,
                        {
                            transform: [{ translateX }],
                            backgroundColor: thumbColor
                        }
                    ]}
                />
            </Animated.View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        width: 32,
        height: 19.2,
        borderRadius: 9.6,
        justifyContent: 'center',
    },
    thumb: {
        width: 12.8,
        height: 12.8,
        borderRadius: 6.4,
        position: 'absolute',
    },
});

export default CustomToggle;
