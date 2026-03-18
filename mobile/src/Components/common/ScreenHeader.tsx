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
    return (
        <View style={styles.header}>
            <View style={styles.headerLeft}>
                <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
                    <BackArrow color="#070707" size={24} />
                </TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
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
