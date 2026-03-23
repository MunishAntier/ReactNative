import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    Pressable,
    TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

interface Props {
    visible: boolean;
    onClose: () => void;
    icon: string;
    title: string;
    description?: string;
    bullets?: string[];
    buttonTitle?: string;
    onButtonPress?: () => void;
}

const BottomSheetModal: React.FC<Props> = ({
    visible,
    onClose,
    icon,
    title,
    description,
    bullets,
    buttonTitle,
    onButtonPress,
}) => (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <Pressable style={s.overlay} onPress={onClose}>
            <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
            <Pressable style={s.sheet}>
                <View style={s.handle} />

                <TouchableOpacity style={s.closeBtn} onPress={onClose} activeOpacity={0.7}>
                    <Ionicons name="close-circle-outline" size={28} color="#8E8E93" />
                </TouchableOpacity>

                <View style={s.iconBox}>
                    <Ionicons name={icon as any} size={28} color="#FFFFFF" />
                </View>

                <Text style={s.title}>{title}</Text>
                {description ? <Text style={s.desc}>{description}</Text> : null}
                {bullets && bullets.length > 0 ? (
                    <View style={s.bulletList}>
                        {bullets.map((item, i) => (
                            <View key={i} style={s.bulletRow}>
                                <Text style={s.bulletDot}>{'\u2022'}</Text>
                                <Text style={s.bulletText}>{item}</Text>
                            </View>
                        ))}
                    </View>
                ) : null}

                {buttonTitle && onButtonPress && (
                    <TouchableOpacity style={s.btn} onPress={onButtonPress} activeOpacity={0.85}>
                        <Text style={s.btnTxt}>{buttonTitle}</Text>
                    </TouchableOpacity>
                )}
            </Pressable>
        </Pressable>
    </Modal>
);

const s = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingHorizontal: 24,
        paddingBottom: 40,
        alignItems: 'center',
    },
    handle: {
        width: 40,
        height: 4,
        backgroundColor: '#000000',
        borderRadius: 2,
        opacity: 0.15,
        marginTop: 12,
        marginBottom: 16,
    },
    closeBtn: {
        position: 'absolute',
        top: 16,
        right: 20,
    },
    iconBox: {
        width: 60,
        height: 60,
        borderRadius: 16,
        backgroundColor: '#0230F9',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        marginTop: 8,
    },
    title: {
        fontFamily: 'Gilroy-Medium',
        fontSize: 20,
        color: '#070707',
        marginBottom: 10,
    },
    desc: {
        fontFamily: 'Gilroy-Regular',
        fontSize: 14,
        color: '#8E8E93',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 24,
        paddingHorizontal: 10,
    },
    bulletList: {
        width: '100%',
        marginBottom: 24,
        gap: 10,
    },
    bulletRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingRight: 16,
    },
    bulletDot: {
        fontFamily: 'Gilroy-Medium',
        fontSize: 16,
        color: '#070707',
        marginRight: 10,
        lineHeight: 22,
    },
    bulletText: {
        flex: 1,
        fontFamily: 'Gilroy-Regular',
        fontSize: 14,
        color: '#070707',
        lineHeight: 22,
    },
    btn: {
        width: '100%',
        backgroundColor: '#070707',
        height: 56,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    btnTxt: {
        fontFamily: 'Gilroy-Medium',
        fontSize: 16,
        color: '#FFFFFF',
    },
});

export default BottomSheetModal;
