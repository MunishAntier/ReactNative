import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface FooterSectionProps {
    buttonTitle: string;
    onButtonPress: () => void;
    children?: React.ReactNode;
}

const FooterSection: React.FC<FooterSectionProps> = ({
    buttonTitle,
    onButtonPress,
    children,
}) => {
    const insets = useSafeAreaInsets();

    return (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            {children}

            <TouchableOpacity
                style={styles.primaryBtn}
                onPress={onButtonPress}
                activeOpacity={0.85}
            >
                <Text style={styles.primaryBtnText}>{buttonTitle}</Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    footer: {
        backgroundColor: '#F5F6F8',
        paddingHorizontal: 24,
        paddingTop: 16,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: '#D4D4D4',
    },
    primaryBtn: {
        backgroundColor: '#111111',
        borderRadius: 14,
        height: 54,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryBtnText: {
        fontFamily: 'ClashDisplay-Bold',
        fontSize: 18,
        fontWeight: '400',
        color: '#FCFDFD',
        letterSpacing: 0.2,
    },
});

export default FooterSection;