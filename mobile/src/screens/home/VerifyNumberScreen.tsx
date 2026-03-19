import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ImageBackground,
    StatusBar,
    SafeAreaView,
    ScrollView,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenHeader from '../../Components/common/ScreenHeader';

interface Props {
    userName: string;
    onBack: () => void;
}

const SafetyNumberScreen: React.FC<Props> = ({ userName, onBack }) => {
    const insets = useSafeAreaInsets();
    const [isVerified, setIsVerified] = useState(false);

    // Mock verification codes (15 groups of 5)
    const codes = Array(15).fill("52569");

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            <ImageBackground
                source={require('../../Assets/images/VerifyNumberBG.png')}
                style={styles.backgroundImage}
                resizeMode="cover"
            >
                <ScreenHeader
                    title="Verify safety number"
                    onBack={onBack}
                    dark
                    backgroundColor="rgba(0,0,0,0.5)"
                />

                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    <View style={styles.content}>
                        <Text style={styles.title}>{isVerified ? 'Verified' : 'Not yet verified'}</Text>
                        <Text style={styles.description}>
                            Verify this safety number with <Text style={styles.userNameHighlight}>{userName}</Text> to confirm your messages are end-to-end encrypted.
                        </Text>

                        {/* Blue Main Card */}
                        <View style={styles.blueCard}>
                            {/* QR Code Card */}
                            <View style={styles.qrCard}>
                                <View style={styles.qrPlaceholder}>
                                    <Ionicons name="qr-code" size={120} color="#070707" />
                                </View>
                                <Text style={styles.tapToScan}>Tap to scan</Text>
                            </View>

                            {/* Numeric Grid */}
                            <View style={styles.gridContainer}>
                                {codes.map((code, index) => (
                                    <View key={index} style={styles.codeItem}>
                                        <Text style={styles.codeText}>{code}</Text>
                                    </View>
                                ))}
                            </View>

                            {/* Action Buttons Row */}
                            <View style={styles.actionRow}>
                                <TouchableOpacity
                                    style={[styles.verifyBtn, isVerified && styles.verifiedBtn]}
                                    onPress={() => setIsVerified(!isVerified)}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.verifyBtnText}>
                                        {isVerified ? 'Clear verification' : 'Mark as verified'}
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.shareBtn} activeOpacity={0.8}>
                                    <Ionicons name="share-social-outline" size={24} color="#070707" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </ScrollView>
            </ImageBackground>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000000',
    },
    backgroundImage: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 40,
    },
    content: {
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingTop: 60,
    },
    title: {
        fontSize: 28,
        color: '#FFFFFF',
        fontFamily: 'Gilroy-Medium',
        fontWeight: 'bold',
        marginBottom: 12,
    },
    description: {
        fontSize: 16,
        color: '#BBBBBB',
        textAlign: 'center',
        fontFamily: 'Gilroy-Regular',
        lineHeight: 22,
        marginBottom: 40,
    },
    userNameHighlight: {
        color: '#FFFFFF',
        fontWeight: 'bold',
    },
    blueCard: {
        width: 350,
        height: 452,
        backgroundColor: '#0230F9',
        borderRadius: 38,
        paddingTop: 50,
        paddingBottom: 50,
        alignItems: 'center',
        gap: 30,
    },
    qrCard: {
        width: 152,
        height: 166,
        backgroundColor: '#FCFDFD',
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 7,
        paddingBottom: 7,
        gap: 8,
    },
    qrPlaceholder: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    tapToScan: {
        fontSize: 14,
        color: '#666666',
        fontFamily: 'Gilroy-Medium',
        marginTop: 5,
    },
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        width: 305, // Increased to fit 5 columns of 45px + 20px gap
        minHeight: 70,
        columnGap: 20,
        rowGap: 5,
        marginBottom: 30,
    },
    codeItem: {
        width: 45, // Increased from 37 to fit 5 digits at 14px size
        height: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    codeText: {
        fontSize: 14,
        color: '#F7F8F9',
        fontFamily: 'Gilroy-Medium',
        fontWeight: '400',
        textAlign: 'center',
        lineHeight: 14, // 100% of 14px
    },
    actionRow: {
        flexDirection: 'row',
        width: 251,
        height: 56,
        gap: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    verifyBtn: {
        width: 181,
        height: 56,
        backgroundColor: '#070707',
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
    },
    verifiedBtn: {
        backgroundColor: '#4CD964',
    },
    verifyBtnText: {
        fontSize: 16,
        color: '#FFFFFF',
        fontFamily: 'Gilroy-Medium',
        fontWeight: '600',
    },
    shareBtn: {
        width: 54,
        height: 54,
        backgroundColor: '#FCFDFD',
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 13.42,
    },
});

export default SafetyNumberScreen;

