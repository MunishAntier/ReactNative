import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import BackArrow from './BackArrow';

interface Props {
    title: string;
    onBack: () => void;
    rightComponent?: React.ReactNode;
    dark?: boolean;
    backgroundColor?: string;
}

const ScreenHeader: React.FC<Props> = ({
    title,
    onBack,
    rightComponent,
    dark = false,
    backgroundColor
}) => {
    const titleColor = dark ? '#FFFFFF' : '#111111';
    const arrowColor = dark ? '#FFFFFF' : '#070707';

    return (
        <View style={[styles.header, backgroundColor ? { backgroundColor } : null]}>
            <View style={styles.headerLeft}>
                <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
                    <BackArrow color={arrowColor} size={24} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: titleColor }]} numberOfLines={1}>{title}</Text>
            </View>
            {rightComponent ? (
                <View style={styles.rightSide}>{rightComponent}</View>
            ) : (
                <View style={styles.rightSideSpacer} />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    header: {
        width: '100%',
        height: 50,
        marginTop: 60, // Consistent with ChatScreen refinement
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24, // Consistent with ChatScreen refinement
        backgroundColor: '#EBEBEC',
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    backBtn: {
        paddingRight: 10,
    },
    headerTitle: {
        fontSize: 20,
        color: '#111111',
        fontFamily: 'Gilroy-Regular',
        lineHeight: 20,
        fontWeight: '400',
    },
    rightSide: {
        minWidth: 40,
        alignItems: 'flex-end',
    },
    rightSideSpacer: {
        width: 40,
    },
});

export default ScreenHeader;
