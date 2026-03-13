import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    Image,
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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

                {/* Concentric circles and key icon */}
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
                    {/* Outer green circle */}
                    <Image
                        source={require('../assets/images/secret_green_circle.png')}
                        style={styles.fullCircle}
                        resizeMode="contain"
                    />

                    {/* Inner blue circle */}
                    <Image
                        source={require('../assets/images/secret_blue_circle.png')}
                        style={[styles.fullCircle, styles.blueCircle]}
                        resizeMode="contain"
                    />

                    {/* Key icon */}
                    <Image
                        source={require('../assets/images/secret_key.png')}
                        style={styles.keyIcon}
                        resizeMode="contain"
                    />
                </View>

                {/* Heading + body */}
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

                {/* End‑to‑End Encrypted pill */}
                <View style={styles.statusWrapper}>
                    <View style={styles.statusPillOuter}>
                        <View style={styles.statusPillInner}>
                            <Image
                                source={require('../assets/images/secret_check_circle.png')}
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
        backgroundColor: '#070707',
    },
    container: {
        flex: 1,
        backgroundColor: '#070707',
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
    blueCircle: {
        width: '70%',
        height: '70%',
    },
    keyIcon: {
        width: '36%',
        height: '36%',
    },
    textBlock: {
        paddingHorizontal: 8,
        alignItems: 'center',
    },
    title: {
        textAlign: 'center',
        color: '#FFFFFF',
        fontFamily: FONT_FAMILIES.clashMedium,
        fontWeight: '500',
        marginBottom: 16,
    },
    subtitle: {
        textAlign: 'center',
        color: '#606060',
        fontFamily: FONT_FAMILIES.clashRegular,
        fontWeight: '400',
    },
    statusWrapper: {
        paddingBottom: 40,
    },
    statusPillOuter: {
        alignSelf: 'center',
        borderRadius: 999,
        borderWidth: 2.67,
        borderColor: '#1E2A78',
        padding: 3,
        backgroundColor: '#3FD3C614',
        shadowColor: '#1E2A78',
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
        elevation: 8,
    },
    statusPillInner: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 999,
        backgroundColor: '#FFFFFF',
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
        fontWeight: '400',
    },
});

export default SecretScreen;

