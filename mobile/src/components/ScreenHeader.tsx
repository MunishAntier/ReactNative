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
}

const ScreenHeader: React.FC<Props> = ({ title, onBack, rightComponent }) => {
    const insets = useSafeAreaInsets();

    return (
        <View style={[
            styles.header,
            {
                paddingTop: Math.max(insets.top, 20),
                paddingBottom: 15,
            }
        ]}>
            <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
                <BackArrow color="#070707" size={24} />
            </TouchableOpacity>
            <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
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
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        justifyContent: 'space-between',
        backgroundColor: '#EBEBEC',
    },
    backBtn: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '400',
        color: '#070707',
        flex: 1,
        marginLeft: 12,
        fontFamily: 'Gilroy-Regular',
        lineHeight: 20,
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
