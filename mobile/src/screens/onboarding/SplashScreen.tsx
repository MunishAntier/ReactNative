import React, { useEffect, useRef } from 'react';
import { StyleSheet, Animated, StatusBar, Image } from 'react-native';

interface SplashScreenProps {
    onFinish: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
        }).start(() => {
            const timer = setTimeout(() => {
                Animated.timing(fadeAnim, {
                    toValue: 0,
                    duration: 600,
                    useNativeDriver: true,
                }).start(() => onFinish());
            }, 2400);

            return () => clearTimeout(timer);
        });
    }, [fadeAnim, onFinish]);

    return (
        <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
            <StatusBar barStyle="light-content" backgroundColor="#000000" />
            <Image
                source={require('../../assets/images/splash_cube_2.png')}
                style={styles.splashImage}
                resizeMode="cover"
            />
        </Animated.View>
    );
};

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000000',
    },
    splashImage: {
        width: '100%',
        height: '100%',
    },
});

export default SplashScreen;
