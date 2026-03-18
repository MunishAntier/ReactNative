import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    Image,
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Rect } from 'react-native-svg';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const BASE_SCREEN_WIDTH = 430;
const BASE_SCREEN_HEIGHT = 932;

const FONT_FAMILIES = {
    clashRegular: 'ClashDisplay-Regular',
    clashMedium: 'ClashDisplay-Medium',
    gilroyMedium: 'Gilroy-Medium',
};

const SecretScreen: React.FC = () => {
    const wScale = SCREEN_W / BASE_SCREEN_WIDTH;
    const hScale = SCREEN_H / BASE_SCREEN_HEIGHT;
    const typeScale = Math.min(wScale, hScale);

    const circleWrapperSize = 196 * wScale;

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                <View style={styles.spacerTop} />

                <View
                    style={[
                        styles.circleWrapper,
                        {
                            width: circleWrapperSize,
                            height: circleWrapperSize,
                            borderRadius: circleWrapperSize / 2,
                        },
                    ]}
                >
                    <Image
                        source={require('../../assets/images/secret_green_circle.png')}
                        style={styles.fullCircle}
                        resizeMode="contain"
                    />

                    <View style={styles.blueBorderRing} />
                    <View style={styles.whiteCircle} />

                    <View style={styles.keyIcon}>
                        <Svg width="100%" height="100%" viewBox="-2 -2 40 28">
                            <Circle cx="10" cy="10" r="7" stroke="#1E2A78" strokeWidth="2.5" fill="none" transform="rotate(-45, 18, 12)" />
                            <Line x1="16" y1="10" x2="33" y2="10" stroke="#1E2A78" strokeWidth="2.5" strokeLinecap="round" transform="rotate(-45, 18, 12)" />
                            <Rect x="29" y="10" width="2.5" height="6" rx="0.5" fill="#1E2A78" transform="rotate(-45, 18, 12)" />
                            <Rect x="24" y="10" width="2.5" height="5" rx="0.5" fill="#1E2A78" transform="rotate(-45, 18, 12)" />
                        </Svg>
                    </View>
                </View>

                <View style={styles.textBlock}>
                    <Text
                        style={[
                            styles.title,
                            {
                                fontSize: 28 * typeScale,
                                lineHeight: 28 * typeScale,
                            },
                        ]}
                    >
                        Securing your{'\n'}private keys...
                    </Text>

                    <Text
                        style={[
                            styles.subtitle,
                            {
                                fontSize: 16 * typeScale,
                                lineHeight: 24 * typeScale,
                            },
                        ]}
                    >
                        Please wait a moment while we set up your personal secure vault. This
                        ensures your messages stay truly private.
                    </Text>
                </View>

                <View style={styles.spacerFlex} />

                <View style={styles.statusWrapper}>
                    <View style={styles.statusPillOuter}>
                        <View style={styles.statusPillInner}>
                            <Image
                                source={require('../../assets/images/secret_check_circle.png')}
                                style={styles.statusIcon}
                                resizeMode="contain"
                            />
                            <Text
                                style={[
                                    styles.statusText,
                                    {
                                        fontSize: 16 * typeScale,
                                        lineHeight: 22.4 * typeScale,
                                    },
                                ]}
                            >
                                End-to-End Encrypted
                            </Text>
                        </View>
                    </View>
                </View>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#E9EDF0',
    },
    container: {
        flex: 1,
        backgroundColor: '#E9EDF0',
        paddingHorizontal: 32,
    },
    spacerTop: {
        height: SCREEN_H * 0.12,
    },
    spacerFlex: {
        flex: 1,
    },
    circleWrapper: {
        alignSelf: 'center',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 40,
    },
    fullCircle: {
        position: 'absolute',
        width: '100%',
        height: '100%',
    },
    blueBorderRing: {
        position: 'absolute',
        width: '65%',
        height: '65%',
        borderRadius: 9999,
        backgroundColor: 'transparent',
        borderWidth: 2.5,
        borderColor: '#1B1464',
    },
    whiteCircle: {
        position: 'absolute',
        width: '52%',
        height: '52%',
        borderRadius: 9999,
        backgroundColor: '#FFFFFF',
    },
    keyIcon: {
        width: '20%',
        height: '20%',
    },
    textBlock: {
        paddingHorizontal: 8,
        alignItems: 'center',
    },
    title: {
        textAlign: 'center',
        color: '#070707',
        fontFamily: FONT_FAMILIES.clashMedium,
        marginBottom: 16,
    },
    subtitle: {
        textAlign: 'center',
        color: '#606060',
        fontFamily: FONT_FAMILIES.clashRegular,
        fontSize: 16,
        lineHeight: 24,
    },
    statusWrapper: {
        paddingBottom: 40,
    },
    statusPillOuter: {
        alignSelf: 'center',
    },
    statusPillInner: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 999,
        backgroundColor: '#E9EDF0',
        borderWidth: 1,
        borderColor: '#34C759',
    },
    statusIcon: {
        width: 20,
        height: 20,
        marginRight: 8,
    },
    statusText: {
        color: '#34C759',
        fontFamily: FONT_FAMILIES.gilroyMedium,
    },
});

export default SecretScreen;
