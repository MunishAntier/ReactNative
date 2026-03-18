import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ImageBackground,
    ImageSourcePropType,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

interface HeroSectionProps {
    title: string;
    subtitle?: string | React.ReactNode;
    onBack?: () => void;
    imageSource?: ImageSourcePropType;
    height?: number;
}

const DEFAULT_HERO_IMAGE = require('../../assets/images/profile_setup_top.png');
const DEFAULT_HEIGHT = 200;

const HeroSection: React.FC<HeroSectionProps> = ({
    title,
    subtitle,
    onBack,
    imageSource = DEFAULT_HERO_IMAGE,
    height = DEFAULT_HEIGHT,
}) => {
    const insets = useSafeAreaInsets();

    return (
        <ImageBackground
            source={imageSource}
            style={[styles.hero, { height: height + insets.top, paddingTop: insets.top }]}
            imageStyle={styles.heroImage}
            resizeMode="cover"
        >
            <View style={styles.heroOverlay} />

            {onBack && (
                <TouchableOpacity
                    style={[styles.backBtn, { top: Math.max(insets.top, 12) }]}
                    onPress={onBack}
                    activeOpacity={0.7}
                >
                    <Ionicons name="arrow-back" size={28} color="#FFFFFF" />
                </TouchableOpacity>
            )}

            <View style={styles.heroContent}>
                <Text style={styles.heroTitle}>{title}</Text>
                {subtitle && (
                    <Text style={styles.heroSubtitle}>
                        {subtitle}
                    </Text>
                )}
            </View>
        </ImageBackground>
    );
};

const styles = StyleSheet.create({
    hero: {
        justifyContent: 'flex-end',
    },
    heroImage: {
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
    },
    heroOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(8, 12, 30, 0.45)',
    },
    backBtn: {
        position: 'absolute',
        left: 24 - 4,
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
    },
    heroContent: {
        paddingHorizontal: 24,
        paddingBottom: 28,
    },
    heroTitle: {
        fontFamily: 'ClashDisplay-Medium',
        fontSize: 28,
        color: '#FCFDFD',
        lineHeight: 28,
        letterSpacing: 0,
        marginBottom: 8,
    },
    heroSubtitle: {
        fontFamily: 'Gilroy-Regular',
        fontSize: 16,
        fontWeight: '400',
        color: '#929292',
        lineHeight: 24,
        letterSpacing: 0,
    },
});

export default HeroSection;
