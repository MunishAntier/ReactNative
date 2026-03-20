import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface FooterSectionProps {
    buttonTitle: string;
    onButtonPress: () => void;
    children?: React.ReactNode;
    disabled?: boolean;
    loading?: boolean;
}

const FooterSection: React.FC<FooterSectionProps> = ({
    buttonTitle,
    onButtonPress,
    children,
    disabled = false,
    loading = false,
}) => {
    const insets = useSafeAreaInsets();

    return (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            {children}

            <TouchableOpacity
                style={[styles.primaryBtn, (disabled || loading) && styles.primaryBtnDisabled]}
                onPress={onButtonPress}
                activeOpacity={0.85}
                disabled={disabled || loading}
            >
                {loading ? (
                    <ActivityIndicator color="#FCFDFD" />
                ) : (
                    <Text style={styles.primaryBtnText}>{buttonTitle}</Text>
                )}
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
    primaryBtnDisabled: {
        opacity: 0.4,
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
