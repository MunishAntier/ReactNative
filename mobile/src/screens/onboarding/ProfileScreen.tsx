import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    ScrollView,
    Image,
    TouchableOpacity,
} from 'react-native';
import HeroSection from '../../components/common/HeroSection';
import FooterSection from '../../components/common/FooterSection';

interface ProfileScreenProps {
    onGoBack: () => void;
    onSave: () => void;
    onEditAvatar?: () => void;
}

const ProfileScreen: React.FC<ProfileScreenProps> = ({ onGoBack, onSave, onEditAvatar }) => {
    const [firstName, setFirstName] = React.useState('');
    const [lastName, setLastName] = React.useState('');
    const [everyoneOnChat, setEveryoneOnChat] = React.useState(true);

    const handleSave = () => {
        onSave();
    };

    return (
        <View style={styles.root}>
            <View style={styles.header}>
                <HeroSection
                    title="Set up your profile"
                    subtitle="Profiles are visible to people you message contacts, and groups."
                    imageSource={require('../../assets/images/profile_setup_top.png')}
                    onBack={onGoBack}
                />
            </View>

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.card}>
                    <View style={styles.avatarWrapper}>
                        <View style={styles.avatarContainer}>
                            <View style={styles.avatarBg}>
                                <Image
                                    source={require('../../assets/images/profile_avatar.png')}
                                    style={styles.avatarImage}
                                    resizeMode="cover"
                                />
                            </View>
                            <TouchableOpacity style={styles.avatarBadge} onPress={onEditAvatar} activeOpacity={0.7}>
                                <Image
                                    source={require('../../assets/images/profile_avatar_badge.png')}
                                    style={styles.avatarBadgeIcon}
                                    resizeMode="contain"
                                />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.form}>
                        <View style={styles.inputWrapper}>
                            <TextInput
                                style={styles.input}
                                value={firstName}
                                onChangeText={setFirstName}
                            />
                            {!firstName && (
                                <View style={styles.placeholderRow} pointerEvents="none">
                                    <Text style={styles.placeholderText}>First Name</Text>
                                    <Text style={styles.placeholderAsterisk}>*</Text>
                                </View>
                            )}
                        </View>

                        <TextInput
                            style={[styles.input, styles.inputSpacing]}
                            placeholder="Last Name (Optional)"
                            placeholderTextColor="#606060"
                            value={lastName}
                            onChangeText={setLastName}
                        />

                        <View style={styles.sectionWhoCanFind}>
                            <Text style={styles.whoTitle}>Who can find?</Text>

                            <View style={styles.checkRow}>
                                <TouchableOpacity onPress={() => setEveryoneOnChat(true)}>
                                    <View style={everyoneOnChat ? styles.checkboxChecked : styles.checkboxEmpty}>
                                        {everyoneOnChat && <Text style={styles.checkTick}>✓</Text>}
                                    </View>
                                </TouchableOpacity>
                                <Text style={styles.checkLabel}>Everyone on Chat</Text>
                            </View>

                            <View style={[styles.checkRow, styles.checkRowSpacing]}>
                                <TouchableOpacity onPress={() => setEveryoneOnChat(false)}>
                                    <View style={!everyoneOnChat ? styles.checkboxChecked : styles.checkboxEmpty}>
                                        {!everyoneOnChat && <Text style={styles.checkTick}>✓</Text>}
                                    </View>
                                </TouchableOpacity>
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
        backgroundColor: '#E4E9EC',
    },
    header: {
        position: 'relative',
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
        backgroundColor: '#E4E9EC',
    },
    avatarWrapper: {
        alignItems: 'center',
        marginBottom: 28,
    },
    avatarContainer: {
        position: 'relative',
        width: 128,
        height: 128,
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
        right: -12,
        top: -8,
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.18,
        shadowRadius: 5,
        elevation: 4,
    },
    avatarBadgeIcon: {
        width: 32,
        height: 32,
    },
    form: {
        gap: 8,
    },
    inputSpacing: {
        marginTop: 8,
    },
    inputWrapper: {
        position: 'relative',
    },
    placeholderRow: {
        position: 'absolute',
        left: 16,
        top: 0,
        bottom: 0,
        flexDirection: 'row',
        alignItems: 'center',
    },
    placeholderText: {
        fontFamily: 'Gilroy-Regular',
        fontSize: 16,
        color: '#606060',
        letterSpacing: 0,
    },
    placeholderAsterisk: {
        fontFamily: 'Gilroy-Regular',
        fontSize: 16,
        color: '#FF4B55',
        letterSpacing: 0,
    },
    input: {
        height: 52,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#B5B5B5',
        paddingHorizontal: 16,
        fontFamily: 'Gilroy-Regular',
        fontSize: 16,
        letterSpacing: 0,
        backgroundColor: '#E4E9EC',
        color: '#606060',
    },
    sectionWhoCanFind: {
        marginTop: 24,
    },
    whoTitle: {
        fontFamily: 'ClashDisplay-Medium',
        fontSize: 30,
        color: '#070707',
        lineHeight: 30,
        letterSpacing: 0.5,
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
        width: 18,
        height: 18,
        borderRadius: 5,
        backgroundColor: '#E4E9EC',
        borderWidth: 1,
        borderColor: '#0230F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkTick: {
        color: '#0230F9',
        fontSize: 14,
        fontWeight: '700',
        lineHeight: 16,
    },
    checkboxEmpty: {
        width: 18,
        height: 18,
        borderRadius: 5,
        borderWidth: 1,
        borderColor: '#BABABA',
    },
    checkLabel: {
        marginLeft: 10,
        fontFamily: 'ClashDisplay-Regular',
        fontSize: 15,
        color: '#070707',
    },
});

export default ProfileScreen;
