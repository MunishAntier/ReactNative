import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    ScrollView,
    Image,
} from 'react-native';
import HeroSection from '../Components/common/HeroSection';
import FooterSection from '../Components/common/FooterSectioon';
import { TouchableOpacity } from 'react-native';

interface ProfileScreenProps {
    onGoBack: () => void;
}

const ProfileScreen: React.FC<ProfileScreenProps> = ({ onGoBack }) => {
    const [firstName, setFirstName] = React.useState('');
    const [lastName, setLastName] = React.useState('');
    const [everyoneOnChat, setEveryoneOnChat] = React.useState(true);

    const handleSave = () => {
        // TODO: wire to backend when available
    };

    return (
        <View style={styles.root}>
            <View style={styles.header}>
                <TouchableOpacity onPress={onGoBack} style={styles.backButton}>
                    <Text style={styles.backButtonText}>← Back</Text>
                </TouchableOpacity>
                <HeroSection
                    title="Set up your profile"
                    subtitle="Profiles are visible to people you message contacts, and groups."
                    imageSource={require('../assets/images/profile_setup_top.png')}
                />
            </View>

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.card}>
                    <View style={styles.avatarWrapper}>
                        <View style={styles.avatarBg}>
                            <Image
                                source={require('../assets/images/profile_avatar.png')}
                                style={styles.avatarImage}
                                resizeMode="cover"
                            />
                        </View>
                        <View style={styles.avatarBadge}>
                            <Image
                                source={require('../assets/images/profile_avatar_badge.png')}
                                style={styles.avatarBadgeIcon}
                                resizeMode="contain"
                            />
                        </View>
                    </View>

                    <View style={styles.form}>
                        <Text style={styles.fieldLabel}>
                            First Name
                            <Text style={styles.requiredMark}>*</Text>
                        </Text>
                        <TextInput
                            style={styles.input}
                            placeholder="First Name"
                            placeholderTextColor="#9C9C9C"
                            value={firstName}
                            onChangeText={setFirstName}
                        />

                        <Text style={[styles.fieldLabel, styles.fieldLabelSpacing]}>
                            Last Name (Optional)
                        </Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Last Name (Optional)"
                            placeholderTextColor="#9C9C9C"
                            value={lastName}
                            onChangeText={setLastName}
                        />

                        <View style={styles.sectionWhoCanFind}>
                            <Text style={styles.whoTitle}>Who can find?</Text>

                            <View style={styles.checkRow}>
                                <View style={styles.checkboxChecked} />
                                <Text style={styles.checkLabel}>Everyone on Chat</Text>
                            </View>

                            <View style={[styles.checkRow, styles.checkRowSpacing]}>
                                <View style={styles.checkboxEmpty} />
                                <Text style={styles.checkLabel}>Nobody</Text>
                            </View>
                        </View>
                    </View>
                </View>
            </ScrollView>

            <FooterSection buttonTitle="Save" onButtonPress={handleSave} />
        </View>
    );
};

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: '#F1F3F7',
    },
    header: {
        position: 'relative',
    },
    backButton: {
        position: 'absolute',
        top: 50,
        left: 20,
        zIndex: 10,
        padding: 10,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 20,
    },
    backButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 24,
    },
    card: {
        width: 382,
        alignSelf: 'center',
        marginTop: 24,
        borderRightWidth: 0.5,
        borderLeftWidth: 0.5,
        borderColor: '#B5B5B5',
        paddingTop: 30,
        paddingHorizontal: 20,
        paddingBottom: 40,
        backgroundColor: '#F5F6F8',
    },
    avatarWrapper: {
        alignItems: 'center',
        marginBottom: 28,
    },
    avatarBg: {
        width: 128,
        height: 128,
        borderRadius: 20,
        overflow: 'hidden',
        backgroundColor: '#B190B6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarImage: {
        width: 128,
        height: 128,
    },
    avatarBadge: {
        position: 'absolute',
        right: 24,
        bottom: 4,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 3,
    },
    avatarBadgeIcon: {
        width: 28,
        height: 28,
    },
    form: {
        gap: 8,
    },
    fieldLabel: {
        fontFamily: 'ClashDisplay-Regular',
        fontSize: 14,
        color: '#626262',
        marginBottom: 6,
    },
    fieldLabelSpacing: {
        marginTop: 14,
    },
    requiredMark: {
        color: '#FF4B55',
    },
    input: {
        height: 52,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#D3D3D3',
        paddingHorizontal: 16,
        fontSize: 16,
        backgroundColor: '#FFFFFF',
        color: '#111111',
    },
    sectionWhoCanFind: {
        marginTop: 24,
    },
    whoTitle: {
        fontFamily: 'ClashDisplay-Medium',
        fontSize: 20,
        fontWeight: '500',
        color: '#111111',
        marginBottom: 16,
    },
    checkRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    checkRowSpacing: {
        marginTop: 10,
    },
    checkboxChecked: {
        width: 20,
        height: 20,
        borderRadius: 4,
        backgroundColor: '#000000',
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxEmpty: {
        width: 20,
        height: 20,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#BABABA',
    },
    checkLabel: {
        marginLeft: 10,
        fontFamily: 'ClashDisplay-Regular',
        fontSize: 15,
        color: '#111111',
    },
});

export default ProfileScreen;

