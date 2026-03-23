import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

type IconLib = 'ionicons' | 'material';

interface Props {
    icon: string;
    iconLib?: IconLib;
    label: string;
    subtitle?: string;
    onPress?: () => void;
    rightComponent?: React.ReactNode;
    showArrow?: boolean;
    isLast?: boolean;
    danger?: boolean;
}

const SettingsMenuItem: React.FC<Props> = ({
    icon,
    iconLib = 'ionicons',
    label,
    subtitle,
    onPress,
    rightComponent,
    showArrow = true,
    isLast = false,
    danger = false,
}) => {
    const IconComponent = iconLib === 'material' ? MaterialCommunityIcons : Ionicons;
    const iconColor = danger ? '#FF3B30' : '#070707';
    const labelColor = danger ? '#FF3B30' : '#070707';
    const iconBg = danger ? '#FFECEB' : '#F2F2F3';

    return (
        <TouchableOpacity
            style={[styles.row, !isLast && styles.border]}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <View style={[styles.iconBox, { backgroundColor: iconBg }]}>
                <IconComponent name={icon as any} size={20} color={iconColor} />
            </View>
            <View style={styles.textCol}>
                <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
                {subtitle ? (
                    <Text style={styles.subtitle}>{subtitle}</Text>
                ) : null}
            </View>
            {rightComponent ?? (showArrow && (
                <Ionicons name="arrow-forward" size={20} color={iconColor} />
            ))}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 15,
    },
    border: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#D4D4D4',
    },
    iconBox: {
        width: 42,
        height: 42,
        borderRadius: 13,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
    },
    textCol: {
        flex: 1,
    },
    label: {
        fontFamily: 'Gilroy-Regular',
        fontSize: 15,
    },
    subtitle: {
        fontFamily: 'Gilroy-Regular',
        fontSize: 12,
        color: '#8E8E93',
        marginTop: 2,
    },
});

export default SettingsMenuItem;
