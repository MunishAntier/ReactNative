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
    disabled?: boolean;
}

const FooterSection: React.FC<FooterSectionProps> = ({
    buttonTitle,
    onButtonPress,
    children,
    disabled = false,
}) => {
    const insets = useSafeAreaInsets();

    return (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            {children}

            <TouchableOpacity
                style={[styles.primaryBtn, disabled && { backgroundColor: '#B5B5B5' }]}
                onPress={onButtonPress}
                activeOpacity={0.85}
                disabled={disabled}
            >
                <Text style={styles.primaryBtnText}>{buttonTitle}</Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    footer: {
        backgroundColor: '#EBEBEC',
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
        fontFamily: 'ClashDisplay-Regular',
        fontSize: 18,
        color: '#FCFDFD',
        letterSpacing: 0.2,
        textAlign: 'center',
    },
});

export default FooterSection;
